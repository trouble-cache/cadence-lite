const { buildSystemPrompt } = require("../prompt/buildSystemPrompt");
const { getLlmClient, hasLlmApiKey, resolveChatModel, resolveLlmProviderConfig } = require("../../llm/client");
const { shouldUseWebSearch, buildWebSearchRequestOptions, extractWebSearchSources } = require("./webSearch");

function formatRecentHistory(recentHistory) {
  if (!recentHistory.length) {
    return "None";
  }

  return recentHistory
    .map((item, index) => {
      const author = item.authorName || item.author?.username || item.role || "unknown";
      const content = item.content || item.text || "";
      return `${index + 1}. ${author}: ${content}`;
    })
    .join("\n");
}

function formatHistoryItem(item) {
  const author = item.authorName || item.author?.username || item.role || "unknown";
  const content = String(item.content || item.text || "").trim();

  if (!content) {
    return "";
  }

  const labels = [];

  if (item.eventType && item.eventType !== "message") {
    labels.push(item.eventType);
  }

  if (item.source && item.source !== "discord") {
    labels.push(item.source);
  }

  if (labels.length) {
    return `${author} [${labels.join(", ")}]: ${content}`;
  }

  return `${author}: ${content}`;
}

function formatMemoryLine(memory, index) {
  if (typeof memory === "string") {
    return `${index + 1}. ${memory}`;
  }

  const memoryType = memory.memoryType || memory.memory_type || "memory";
  const domain = memory.domain ? `/${memory.domain}` : "";
  const referenceDate = memory.referenceDate || memory.reference_date;
  const dateNote = referenceDate ? ` (date: ${referenceDate})` : "";
  const title = memory.title ? `${memory.title}: ` : "";
  return `${index + 1}. [${memoryType}${domain}]${dateNote} ${title}${memory.content || memory.text || JSON.stringify(memory)}`;
}

function formatMemorySection(label, items) {
  if (!items.length) {
    return `${label}:\nNone`;
  }

  return `${label}:\n${items.map((memory, index) => formatMemoryLine(memory, index)).join("\n")}`;
}

function formatMemories(memories) {
  if (!memories.length) {
    return "Memories:\nNone";
  }

  const durableMemories = memories.filter((memory) => {
    const memoryType = typeof memory === "string" ? "" : (memory.memoryType || memory.memory_type || "");
    return ["anchor", "canon", "resolved"].includes(memoryType);
  });

  return formatMemorySection("Memories", durableMemories);
}

function buildBackgroundContext({
  input,
  contextSections = [],
  memories,
  totalToolCount,
  includeTimeContext,
  configuredTimezone,
  now,
  automation,
}) {
  const sections = [
    `Author: ${input.authorName}`,
    `Input types: ${input.inputTypes.join(", ") || "text"}`,
    ...contextSections
      .filter((section) => section?.label && String(section.content || "").trim())
      .map((section) => `${section.label}:\n${String(section.content).trim()}`),
    `Relevant memories:\n${formatMemories(memories)}`,
    `Available tool count: ${totalToolCount}`,
  ];

  if (automation) {
    sections.unshift("This turn came from an automation trigger rather than a live user message.");
  }

  if (includeTimeContext) {
    sections.splice(1, 0,
      `Message timestamp: ${formatTimestamp(input.messageTimestamp, configuredTimezone)}`,
      `Current system time (${configuredTimezone}): ${formatTimestamp(now.toISOString(), configuredTimezone)}`,
    );
  }

  return sections.join("\n\n");
}

function mapHistoryRole(item) {
  if (item.role === "assistant") {
    return "assistant";
  }

  if (item.role === "system") {
    return "system";
  }

  return "user";
}

function buildModelInput({
  input,
  recentHistory,
  memories,
  contextSections,
  totalToolCount,
  includeTimeContext,
  configuredTimezone,
  now,
  automation,
}) {
  const priorTurns = recentHistory
    .map((item) => ({
      role: mapHistoryRole(item),
      content: [
        {
          type: "input_text",
          text: formatHistoryItem(item),
        },
      ],
    }))
    .filter((item) => item.content[0].text);

  const backgroundContext = buildBackgroundContext({
    input,
    contextSections,
    memories,
    totalToolCount,
    includeTimeContext,
    configuredTimezone,
    now,
    automation,
  });

  return [
    ...priorTurns,
    {
      role: "system",
      content: [
        {
          type: "input_text",
          text: backgroundContext,
        },
      ],
    },
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text: input.content,
        },
      ],
    },
  ];
}

function formatTimestamp(value, timezone = "UTC") {
  const date = new Date(value);
  const resolvedTimezone = String(timezone || "").trim() || "UTC";

  return `${date.toISOString()} (${new Intl.DateTimeFormat("en-GB", {
    timeZone: resolvedTimezone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  }).format(date)})`;
}

async function callModel({
  config,
  logger,
  mode,
  input,
  recentHistory,
  memories,
  tools,
  automation = null,
  contextSections = [],
}) {
  const selectedModel = mode?.chatModel || resolveChatModel(config);

  if (!hasLlmApiKey(config, "chat")) {
    return {
      provider: "placeholder",
      mode: mode.name,
      toolCount: tools.list().length,
      summary: {
        input: input.content,
        recentHistoryCount: recentHistory.length,
        memoryCount: memories.length,
        model: selectedModel || config.chat.placeholderModel,
      },
    };
  }

  const client = getLlmClient(config, "chat");
  const startedAt = Date.now();
  const now = new Date();
  const providerConfig = resolveLlmProviderConfig(config, "chat");
  const providerLabel = providerConfig.provider;
  const includeTimeContext = config.chat?.includeTimeContext !== false;
  const configuredTimezone = config.chat?.timezone || "UTC";
  const useWebSearch = shouldUseWebSearch({ input, automation });
  const totalToolCount = tools.list().length + (useWebSearch ? 1 : 0);

  logger.debug("[chat] Preparing AI reply", {
    provider: providerLabel,
    model: selectedModel,
    mode: mode.name,
    inputLength: input.content.length,
    inputTypes: input.inputTypes,
    recentHistoryCount: recentHistory.length,
    memoryCount: memories.length,
    toolCount: totalToolCount,
    webSearch: useWebSearch,
  });

  const request = {
    model: selectedModel,
    instructions: buildSystemPrompt({ config, mode, automation, webSearchUsed: useWebSearch }),
    input: buildModelInput({
      input,
      recentHistory,
      memories,
      contextSections,
      totalToolCount,
      includeTimeContext,
      configuredTimezone,
      now,
      automation,
    }),
  };

  if (useWebSearch) {
    Object.assign(request, buildWebSearchRequestOptions({ provider: providerLabel }));
  }

  const response = await client.responses.create(request);

  const text = response.output_text?.trim();
  const sources = useWebSearch ? extractWebSearchSources(response) : [];

  if (!text) {
    logger.warn("[chat] OpenAI response did not include output_text");
  }

  logger.debug("[chat] AI reply received", {
    provider: providerLabel,
    model: selectedModel,
    outputLength: text ? text.length : 0,
    responseId: response.id,
    sourceCount: sources.length,
  });

  return {
    provider: providerLabel,
    mode: mode.name,
    toolCount: totalToolCount,
    text: text || "I had a thought, but it failed to arrive in a usable form.",
    sources,
    webSearchUsed: useWebSearch,
    summary: {
      input: input.content,
      recentHistoryCount: recentHistory.length,
      memoryCount: memories.length,
      model: selectedModel,
    },
  };
}

module.exports = {
  buildModelInput,
  buildBackgroundContext,
  formatHistoryItem,
  formatMemories,
  formatTimestamp,
  callModel,
};
