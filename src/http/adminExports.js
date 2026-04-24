const {
  MAX_CONVERSATION_EXPORT_CONVERSATIONS,
  MAX_CONVERSATION_LOG_EXPORT_EVENTS,
  MAX_CONVERSATION_EVENT_CSV_ROWS,
  buildConversationEventsCsv,
  buildConversationLogFilename,
  buildConversationLogsIndexCsv,
  buildConversationLogsMetadata,
  createZipBuffer,
} = require("../storage");

function buildMemoryExportPayload({ memories = [] }) {
  return {
    exportedAt: new Date().toISOString(),
    product: "cadence-lite",
    memoryCount: memories.length,
    memories: memories.map((memory) => ({
      memoryId: memory.memoryId,
      title: memory.title,
      content: memory.content,
      memoryType: memory.memoryType,
      domain: memory.domain,
      sensitivity: memory.sensitivity,
      source: memory.source,
      active: Boolean(memory.active),
      referenceDate: memory.referenceDate || null,
      createdAt: memory.createdAt || null,
      updatedAt: memory.updatedAt || null,
    })),
  };
}

function buildAppSettingsExportPayload({
  settings = {},
  automations = [],
  journalEntries = [],
}) {
  return {
    exportedAt: new Date().toISOString(),
    product: "cadence-lite",
    exportType: "app_settings",
    includes: [
      "app_settings",
      "automations",
      "journal_entries",
    ],
    counts: {
      settings: Object.keys(settings || {}).length,
      automations: automations.length,
      journalEntries: journalEntries.length,
    },
    settings,
    automations: automations.map((automation) => ({
      automationId: automation.automationId,
      userScope: automation.userScope,
      type: automation.type,
      label: automation.label,
      channelId: automation.channelId,
      scheduleTime: automation.scheduleTime,
      timezone: automation.timezone,
      prompt: automation.prompt,
      enabled: Boolean(automation.enabled),
      mentionUser: Boolean(automation.mentionUser),
      userId: automation.userId || null,
      lastRunAt: automation.lastRunAt || null,
      lastError: automation.lastError || "",
      createdAt: automation.createdAt || null,
      updatedAt: automation.updatedAt || null,
    })),
    journalEntries: journalEntries.map((entry) => ({
      entryId: entry.entryId,
      userScope: entry.userScope,
      automationId: entry.automationId || null,
      channelId: entry.channelId || null,
      guildId: entry.guildId || null,
      title: entry.title,
      content: entry.content,
      createdAt: entry.createdAt || null,
    })),
  };
}

async function streamMemoryExport({ res, context, durableMemoryTypes }) {
  const allMemories = await context.memoryStore.listMemories({
    userScope: context.config.memory.userScope,
    limit: 5000,
    activeOnly: false,
  });
  const durableMemories = allMemories
    .filter((memory) => durableMemoryTypes.includes(memory.memoryType))
    .sort((left, right) => {
      const leftTime = Date.parse(left.updatedAt || "") || 0;
      const rightTime = Date.parse(right.updatedAt || "") || 0;
      return rightTime - leftTime;
    });
  const payload = buildMemoryExportPayload({
    memories: durableMemories,
  });
  const dateStamp = new Date().toISOString().slice(0, 10);

  res.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Disposition": `attachment; filename="cadence-memories-${dateStamp}.json"`,
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload, null, 2));
}

async function streamAppSettingsExport({ res, context }) {
  const [settings, automations, journalEntries] = await Promise.all([
    context.settingsStore.listSettings(),
    context.automationStore.listAutomations({
      userScope: context.config.memory.userScope,
    }),
    context.journalStore.listEntries({
      userScope: context.config.memory.userScope,
      limit: 5000,
    }),
  ]);
  const payload = buildAppSettingsExportPayload({
    settings,
    automations,
    journalEntries,
  });
  const dateStamp = new Date().toISOString().slice(0, 10);

  res.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Disposition": `attachment; filename="cadence-app-settings-${dateStamp}.json"`,
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload, null, 2));
}

async function streamConversationEventsCsvExport({ res, context }) {
  const guildId = context.config.discord.guildId || "";
  const rows = await context.conversations.listEventsForExport({
    guildId,
    limit: MAX_CONVERSATION_EVENT_CSV_ROWS,
  });
  const payload = buildConversationEventsCsv(rows);
  const dateStamp = new Date().toISOString().slice(0, 10);

  res.writeHead(200, {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="cadence-conversation-events-${dateStamp}.csv"`,
    "Cache-Control": "no-store",
  });
  res.end(payload);
}

async function streamConversationLogsExport({ res, context }) {
  const guildId = context.config.discord.guildId || "";
  const conversations = await context.conversations.listConversations({
    guildId,
    limit: MAX_CONVERSATION_EXPORT_CONVERSATIONS,
  });
  const usedLogNames = new Set();
  const generatedAt = new Date().toISOString();
  const files = [];
  const indexEntries = [];

  for (const conversation of conversations) {
    const events = await context.conversations.listEventsByConversationId({
      conversationId: conversation.conversationId,
      guildId,
      limit: MAX_CONVERSATION_LOG_EXPORT_EVENTS,
    });
    const filename = buildConversationLogFilename(conversation, usedLogNames);
    const content = context.conversations.formatConversationExport(events, {
      conversation,
    });

    files.push({
      name: `logs/${filename}`,
      content: `${content}\n`,
      modifiedAt: conversation.lastEventAt || generatedAt,
    });
    indexEntries.push({
      ...conversation,
      filename,
      eventCount: events.length,
    });
  }

  files.push({
    name: "index.csv",
    content: buildConversationLogsIndexCsv(indexEntries),
    modifiedAt: generatedAt,
  });
  files.push({
    name: "metadata.json",
    content: JSON.stringify(buildConversationLogsMetadata({
      entries: indexEntries,
      generatedAt,
      conversationLimit: MAX_CONVERSATION_EXPORT_CONVERSATIONS,
      perConversationEventLimit: MAX_CONVERSATION_LOG_EXPORT_EVENTS,
    }), null, 2),
    modifiedAt: generatedAt,
  });

  const payload = createZipBuffer(files, { now: generatedAt });
  const dateStamp = generatedAt.slice(0, 10);

  res.writeHead(200, {
    "Content-Type": "application/zip",
    "Content-Disposition": `attachment; filename="cadence-conversation-logs-${dateStamp}.zip"`,
    "Cache-Control": "no-store",
  });
  res.end(payload);
}

module.exports = {
  buildMemoryExportPayload,
  buildAppSettingsExportPayload,
  streamMemoryExport,
  streamAppSettingsExport,
  streamConversationEventsCsvExport,
  streamConversationLogsExport,
};
