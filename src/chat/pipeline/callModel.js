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

function formatTimestamp(value) {
  const date = new Date(value);

  return `${date.toISOString()} (${date.toLocaleString("en-GB", {
    dateStyle: "full",
    timeStyle: "long",
  })})`;
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
  const useWebSearch = shouldUseWebSearch({ input });
  const totalToolCount = tools.list().length + (useWebSearch ? 1 : 0);

  logger.info("[chat] Calling model", {
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
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: [
              `${automation ? "Automation trigger" : "User message"}: ${input.content}`,
              `Author: ${input.authorName}`,
              ...(includeTimeContext
                ? [
                  `Message timestamp: ${formatTimestamp(input.messageTimestamp)}`,
                  `Current system time: ${formatTimestamp(now.toISOString())}`,
                ]
                : []),
              `Input types: ${input.inputTypes.join(", ") || "text"}`,
              ...contextSections
                .filter((section) => section?.label && String(section.content || "").trim())
                .map((section) => `${section.label}:\n${String(section.content).trim()}`),
              `Recent history:\n${formatRecentHistory(recentHistory)}`,
              `Relevant memories:\n${formatMemories(memories)}`,
              `Available tool count: ${totalToolCount}`,
            ].join("\n\n"),
          },
        ],
      },
    ],
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

  logger.info("[chat] Model response received", {
    provider: providerLabel,
    model: selectedModel,
    durationMs: Date.now() - startedAt,
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
  formatMemories,
  callModel,
};
