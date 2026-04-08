const { DEFAULT_CHAT_MODE } = require("../chat/defaultMode");
const { callModel } = require("../chat/pipeline/callModel");
const { buildMemoryQueries, buildRecentUserContext } = require("../chat/pipeline/retrieveMemory");
const { splitTextIntoChunks } = require("../bot/events/messageCreate");
const { normalizeAttachments, summarizeAttachments } = require("../utils/attachments");
const { buildEventContentText } = require("../storage");

function getLocalDateParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    dateKey: `${map.year}-${map.month}-${map.day}`,
    timeKey: `${map.hour}:${map.minute}`,
  };
}

function automationRanToday(automation, now = new Date()) {
  if (!automation?.lastRunAt) {
    return false;
  }

  const current = getLocalDateParts(now, automation.timezone || "UTC");
  const previous = getLocalDateParts(new Date(automation.lastRunAt), automation.timezone || "UTC");
  return current.dateKey === previous.dateKey;
}

function isAutomationDueNow(automation, now = new Date()) {
  if (!automation?.enabled || !["check_in", "journal"].includes(automation.type)) {
    return false;
  }

  const current = getLocalDateParts(now, automation.timezone || "UTC");
  return current.timeKey === automation.scheduleTime && !automationRanToday(automation, now);
}

function buildAutomationInput({ automation }) {
  return {
    content: automation.type === "journal"
      ? `Scheduled journal: ${automation.label}`
      : `Scheduled action: ${automation.label}`,
    authorId: "cadence-automation",
    authorName: "Cadence Automation",
    channelId: automation.channelId,
    messageId: `automation-${automation.automationId}`,
    messageTimestamp: new Date().toISOString(),
    attachments: [],
    inputTypes: ["text"],
  };
}

function shuffleInPlace(items, randomFn = Math.random) {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(randomFn() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
}

function buildJournalConversationLabel(event) {
  const metadata = event?.metadata || {};
  return metadata.threadName || metadata.channelName || event.conversation_id || "recent conversation";
}

function pickRandomContiguousWindow(events = [], maxMessagesPerSlice = 8, randomFn = Math.random) {
  if (events.length <= maxMessagesPerSlice) {
    return [...events];
  }

  const maxStartIndex = events.length - maxMessagesPerSlice;
  const startIndex = Math.max(0, Math.min(
    maxStartIndex,
    Math.floor(randomFn() * (maxStartIndex + 1)),
  ));

  return events.slice(startIndex, startIndex + maxMessagesPerSlice);
}

function buildJournalSliceContent(events = [], { config } = {}) {
  const userName = config?.chat?.promptBlocks?.userName || "User";
  const aiName = config?.chat?.promptBlocks?.personaName || "Cadence";

  return events
    .map((event) => {
      const author = event.role === "user"
        ? `${userName} (user)`
        : event.role === "assistant"
          ? `${aiName} (AI)`
          : (event.author_name || event.role || "unknown");
      return `${author}: ${buildEventContentText(event)}`;
    })
    .join("\n");
}

function buildRecentJournalEntriesContent(entries = []) {
  return entries
    .map((entry, index) => {
      const timestamp = new Date(entry.createdAt).toISOString();
      return [
        `${index + 1}. ${entry.title} (${timestamp})`,
        entry.content,
      ].join("\n");
    })
    .join("\n\n");
}

function selectJournalConversationSlices({
  events = [],
  excludedChannelId = "",
  lookbackMs = 24 * 60 * 60 * 1000,
  now = new Date(),
  maxSlices = 2,
  maxMessagesPerSlice = 8,
  randomFn = Math.random,
}) {
  const nowMs = now.getTime();
  const grouped = new Map();

  for (const event of events) {
    const createdAt = Date.parse(event.created_at || event.createdAt || "");

    if (!Number.isFinite(createdAt) || createdAt < nowMs - lookbackMs || createdAt > nowMs) {
      continue;
    }

    if (event.channel_id === excludedChannelId || event.conversation_id === excludedChannelId) {
      continue;
    }

    if (event.event_type !== "message") {
      continue;
    }

    if (!["user", "assistant"].includes(event.role)) {
      continue;
    }

    const content = buildEventContentText(event).trim();

    if (!content) {
      continue;
    }

    const key = event.conversation_id;

    if (!grouped.has(key)) {
      grouped.set(key, []);
    }

    grouped.get(key).push(event);
  }

  const candidates = Array.from(grouped.values())
    .map((conversationEvents) => conversationEvents.sort((left, right) => new Date(left.created_at) - new Date(right.created_at)))
    .filter((conversationEvents) => conversationEvents.length >= 2)
    .map((conversationEvents) => ({
      label: buildJournalConversationLabel(conversationEvents[0]),
      latestAt: conversationEvents[conversationEvents.length - 1].created_at,
      events: pickRandomContiguousWindow(conversationEvents, maxMessagesPerSlice, randomFn),
    }))
    .sort((left, right) => Date.parse(right.latestAt) - Date.parse(left.latestAt));

  const pool = candidates.slice(0, 6);
  const selected = shuffleInPlace(pool, randomFn)
    .slice(0, maxSlices)
    .sort((left, right) => Date.parse(left.latestAt) - Date.parse(right.latestAt));

  return selected;
}

async function loadJournalContextSections({
  conversations,
  config,
  journalStore,
  userScope,
  guildId,
  excludedChannelId,
  now = new Date(),
  randomFn = Math.random,
}) {
  const startDate = new Date(now.getTime() - (24 * 60 * 60 * 1000)).toISOString().slice(0, 10);
  const endDate = now.toISOString().slice(0, 10);
  const events = await conversations.listEventsByDateRange({
    startDate,
    endDate,
    limit: 2000,
    includeSummaries: false,
  });
  const scopedEvents = events.filter((event) => !guildId || event.guild_id === guildId);
  const slices = selectJournalConversationSlices({
    events: scopedEvents,
    excludedChannelId,
    now,
    maxSlices: 1,
    randomFn,
  });

  if (!slices.length) {
    const recentEntries = await journalStore.listRecentEntries({
      userScope,
      limit: 5,
    });

    return {
      selectedSlice: null,
      sections: recentEntries.length
      ? [{
        label: "Recent journal entries",
        content: buildRecentJournalEntriesContent(recentEntries),
      }]
      : [],
    };
  }

  const recentEntries = await journalStore.listRecentEntries({
    userScope,
    limit: 5,
  });

  const sections = [{
      label: "Selected conversation excerpt from the last 24 hours",
      content: [
        slices[0].label,
        buildJournalSliceContent(slices[0].events, { config }),
      ].join("\n"),
    }];

  if (recentEntries.length) {
    sections.push({
      label: "Recent journal entries",
      content: buildRecentJournalEntriesContent(recentEntries),
    });
  }

  return {
    selectedSlice: slices[0],
    sections,
  };
}

function buildHistoryContent(message) {
  const parts = [];
  const attachments = normalizeAttachments(message.attachments);

  if (message.content?.trim()) {
    parts.push(message.content.trim());
  }

  if (attachments.length) {
    parts.push(summarizeAttachments(attachments));
  }

  return parts.join(" ").trim();
}

async function loadAutomationRecentHistory({ channel, limit = 8, now = new Date(), lookbackMs = null }) {
  const recentMessages = await channel.messages.fetch({ limit: Math.max(limit * 3, limit) });
  const threshold = lookbackMs ? now.getTime() - lookbackMs : null;

  return recentMessages
    .sort((left, right) => left.createdTimestamp - right.createdTimestamp)
    .map((item) => ({
      id: item.id,
      authorId: item.author?.id || "",
      authorName: item.member?.displayName || item.author?.globalName || item.author?.username || "unknown",
      isBot: Boolean(item.author?.bot),
      content: buildHistoryContent(item),
      attachments: normalizeAttachments(item.attachments),
      createdTimestamp: item.createdTimestamp,
    }))
    .filter((item) => item.content)
    .filter((item) => threshold === null || item.createdTimestamp >= threshold)
    .slice(-limit);
}

async function retrieveAutomationMemories({ memory, channel, input, mode }) {
  const recentMessages = await channel.messages.fetch({ limit: 8 });
  const recentUserContext = buildRecentUserContext(recentMessages
    .filter((item) => !item.author?.bot && item.content?.trim())
    .sort((left, right) => left.createdTimestamp - right.createdTimestamp)
    .map((item) => ({
      role: "user",
      content: item.content.trim(),
    })));

  return memory.retrieve({
    guildId: channel.guildId,
    userId: input.authorId,
    query: buildMemoryQueries({
      input,
      mode,
      recentUserContext,
    }),
    mode: mode.name,
  });
}

function buildJournalSliceMemoryQuery({ slice, input, mode }) {
  const userEvents = Array.isArray(slice?.events)
    ? slice.events.filter((event) => event.role === "user")
    : [];

  if (!userEvents.length) {
    return buildMemoryQueries({
      input,
      mode,
      recentUserContext: "",
    });
  }

  const latestUserEvent = userEvents[userEvents.length - 1];
  const earlierUserEvents = userEvents.slice(0, -1).map((event) => ({
    role: "user",
    content: buildEventContentText(event),
  }));

  return buildMemoryQueries({
    input: {
      ...input,
      content: buildEventContentText(latestUserEvent),
    },
    mode,
    recentUserContext: buildRecentUserContext(earlierUserEvents),
  });
}

async function retrieveJournalMemories({
  memory,
  channel,
  input,
  mode,
  selectedSlice = null,
}) {
  return memory.retrieve({
    guildId: channel.guildId,
    userId: input.authorId,
    query: buildJournalSliceMemoryQuery({
      slice: selectedSlice,
      input,
      mode,
    }),
    mode: mode.name,
  });
}

async function persistAutomationState(store, automation, updates) {
  return store.upsertAutomation({
    automation_id: automation.automationId,
    type: automation.type,
    label: automation.label,
    channel_id: automation.channelId,
    schedule_time: automation.scheduleTime,
    timezone: automation.timezone,
    prompt: automation.prompt,
    enabled: automation.enabled,
    mention_user: automation.mentionUser,
    user_id: automation.userId || "",
    last_run_at: updates.lastRunAt || automation.lastRunAt || "",
    last_error: updates.lastError ?? automation.lastError ?? "",
  }, {
    userScope: automation.userScope,
  });
}

async function runCheckInAutomation({
  automation,
  client,
  config,
  logger,
  memory,
  tools,
  conversations,
  automationStore,
}) {
  const channel = await client.channels.fetch(automation.channelId);

  if (!channel?.isTextBased?.()) {
    throw new Error("Configured channel is not text-based.");
  }

  const mode = DEFAULT_CHAT_MODE;
  const historyLimit = Number.isFinite(config.chat?.historyLimit)
    ? config.chat.historyLimit
    : (mode.historyLimit || 20);
  const input = buildAutomationInput({ automation });
  const recentHistory = await loadAutomationRecentHistory({
    channel,
    limit: historyLimit,
  });
  let memories = [];

  try {
    memories = await retrieveAutomationMemories({
      memory,
      channel,
      input,
      mode,
    });
  } catch (error) {
    logger.error("[automations] Memory retrieval failed during check-in automation", {
      automationId: automation.automationId,
      label: automation.label,
      error: error.message,
    }, error);
  }
  const modelOutput = await callModel({
    config,
    logger,
    mode,
    input,
    recentHistory,
    memories,
    tools,
    automation: {
      label: automation.label,
      prompt: automation.prompt,
      userName: config.chat?.promptBlocks?.userName || "the user",
    },
  });
  const text = String(modelOutput.text || "").trim();

  if (!text) {
    throw new Error("Automation produced no message text.");
  }

  const finalText = automation.mentionUser && automation.userId
    ? `<@${automation.userId}> ${text}`
    : text;
  const chunks = splitTextIntoChunks(finalText);
  let sentMessage = null;

  for (const chunk of chunks) {
    sentMessage = await channel.send({ content: chunk });
  }

  if (sentMessage) {
    await conversations.recordEvent({
      message: sentMessage,
      role: "assistant",
      source: "cadence",
      eventType: "message",
      contentText: chunks.join("\n\n"),
      authorName:
        sentMessage.member?.displayName ||
        sentMessage.author?.globalName ||
        sentMessage.author?.username ||
        config.chat?.promptBlocks?.personaName ||
        "Cadence",
      metadata: {
        automationId: automation.automationId,
        automationType: automation.type,
        automationLabel: automation.label,
        chunkCount: chunks.length,
      },
    });
  }

  await persistAutomationState(automationStore, automation, {
    lastRunAt: new Date().toISOString(),
    lastError: "",
  });
}

async function runJournalAutomation({
  automation,
  client,
  config,
  logger,
  memory,
  journalStore,
  tools,
  conversations,
  automationStore,
}) {
  const channel = await client.channels.fetch(automation.channelId);

  if (!channel?.isTextBased?.()) {
    throw new Error("Configured channel is not text-based.");
  }

  const mode = DEFAULT_CHAT_MODE;
  const input = buildAutomationInput({ automation });
  const recentHistory = [];
  const journalContext = await loadJournalContextSections({
    conversations,
    config,
    journalStore,
    userScope: config.memory.userScope,
    guildId: channel.guildId,
    excludedChannelId: automation.channelId,
  });
  let memories = [];

  try {
    memories = await retrieveJournalMemories({
      memory,
      channel,
      input,
      mode,
      selectedSlice: journalContext.selectedSlice,
    });
  } catch (error) {
    logger.error("[automations] Memory retrieval failed during journal automation", {
      automationId: automation.automationId,
      label: automation.label,
      error: error.message,
    }, error);
  }

  const modelOutput = await callModel({
    config,
    logger,
    mode,
    input,
    recentHistory,
    memories,
    tools,
    contextSections: journalContext.sections,
    automation: {
      type: automation.type,
      label: automation.label,
      prompt: automation.prompt,
      userName: config.chat?.promptBlocks?.userName || "the user",
    },
  });
  const text = String(modelOutput.text || "").trim();

  if (!text) {
    throw new Error("Automation produced no message text.");
  }

  const finalText = automation.mentionUser && automation.userId
    ? `<@${automation.userId}> ${text}`
    : text;
  const chunks = splitTextIntoChunks(finalText);
  let sentMessage = null;

  for (const chunk of chunks) {
    sentMessage = await channel.send({ content: chunk });
  }

  if (sentMessage) {
    await journalStore.recordEntry({
      automationId: automation.automationId,
      channelId: automation.channelId,
      guildId: channel.guildId,
      title: automation.label,
      content: chunks.join("\n\n"),
    }, {
      userScope: config.memory.userScope,
      createdAt: sentMessage.createdAt?.toISOString?.() || new Date().toISOString(),
    });

    await conversations.recordEvent({
      message: sentMessage,
      role: "assistant",
      source: "cadence",
      eventType: "message",
      contentText: chunks.join("\n\n"),
      authorName:
        sentMessage.member?.displayName ||
        sentMessage.author?.globalName ||
        sentMessage.author?.username ||
        config.chat?.promptBlocks?.personaName ||
        "Cadence",
      metadata: {
        automationId: automation.automationId,
        automationType: automation.type,
        automationLabel: automation.label,
        chunkCount: chunks.length,
      },
    });
  }

  await persistAutomationState(automationStore, automation, {
    lastRunAt: new Date().toISOString(),
    lastError: "",
  });
}

function createAutomationRunner({
  client,
  config,
  logger,
  automationStore,
  memory,
  journalStore,
  tools,
  conversations,
}) {
  let interval = null;
  let running = false;

  async function tick(now = new Date()) {
    if (running) {
      return;
    }

    running = true;

    try {
      const automations = await automationStore.listAutomations({
        userScope: config.memory.userScope,
        enabledOnly: true,
      });

      for (const automation of automations) {
        if (!isAutomationDueNow(automation, now)) {
          continue;
        }

        try {
          logger.info("[automations] Running a scheduled automation", {
            automationId: automation.automationId,
            type: automation.type,
            label: automation.label,
            channelId: automation.channelId,
            scheduleTime: automation.scheduleTime,
          });

          if (automation.type === "journal") {
            await runJournalAutomation({
              automation,
              client,
              config,
              logger,
              memory,
              journalStore,
              tools,
              conversations,
              automationStore,
            });
          } else {
            await runCheckInAutomation({
              automation,
              client,
              config,
              logger,
              memory,
              tools,
              conversations,
              automationStore,
            });
          }
        } catch (error) {
          logger.error("[automations] Automation run failed", {
            automationId: automation.automationId,
            label: automation.label,
            error: error.message,
          }, error);

          await persistAutomationState(automationStore, automation, {
            lastError: error.message,
          });
        }
      }
    } finally {
      running = false;
    }
  }

  return {
    start() {
      if (interval) {
        return;
      }

      interval = setInterval(() => {
        tick().catch((error) => {
          logger.error("[automations] Scheduler tick failed", {
            error: error.message,
          }, error);
        });
      }, 30_000);
    },
    async runNow(now = new Date()) {
      await tick(now);
    },
    stop() {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    },
  };
}

module.exports = {
  createAutomationRunner,
  buildAutomationInput,
  isAutomationDueNow,
  automationRanToday,
  buildJournalSliceMemoryQuery,
  pickRandomContiguousWindow,
  selectJournalConversationSlices,
};
