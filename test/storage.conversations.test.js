const test = require("node:test");
const assert = require("node:assert/strict");

const {
  DEFAULT_HISTORY_LIMIT,
  buildEventContentText,
  buildConversationExportHeader,
  buildConversationSummary,
  formatConversationExport,
  mapEventToHistoryItem,
  formatEventAsPlainText,
  resolveConversationScope,
  validateEventInput,
} = require("../src/storage/conversations");

test("validateEventInput normalizes valid role/source/event_type values", () => {
  const validated = validateEventInput({
    role: "Assistant",
    source: "Discord",
    eventType: "Message",
    metadata: { foo: "bar" },
  });

  assert.deepEqual(validated, {
    role: "assistant",
    source: "discord",
    eventType: "message",
    metadata: { foo: "bar" },
  });
});

test("validateEventInput rejects unsupported event types", () => {
  assert.throws(
    () => validateEventInput({
      role: "user",
      source: "discord",
      eventType: "wizard_event",
      metadata: {},
    }),
    /Unsupported event_type/,
  );
});

test("non-message events get readable inline labels for export and history", () => {
  const event = {
    id: 42,
    role: "system",
    source: "cadence",
    event_type: "image_analysis",
    author_name: "Cadence",
    author_id: "bot-1",
    content_text: "Georgia is holding a railway map.",
    metadata: { attachments: [] },
    created_at: "2026-03-20T10:00:00.000Z",
  };

  assert.equal(buildEventContentText(event), "[image_analysis] Georgia is holding a railway map.");

  assert.deepEqual(mapEventToHistoryItem(event), {
    id: "42",
    authorId: "bot-1",
    authorName: "Cadence",
    isBot: true,
    content: "[image_analysis] Georgia is holding a railway map.",
    attachments: [],
    createdTimestamp: Date.parse("2026-03-20T10:00:00.000Z"),
    role: "system",
    source: "cadence",
    eventType: "image_analysis",
  });

  assert.equal(
    formatEventAsPlainText(event),
    "[2026-03-20T10:00:00.000Z] Cadence: [image_analysis] Georgia is holding a railway map.",
  );
});

test("buildConversationSummary prefers thread labels when present", () => {
  const summary = buildConversationSummary({
    conversation_id: "thread-1",
    thread_id: "thread-1",
    channel_id: "channel-1",
    guild_id: "guild-1",
    thread_name: "daily-check-in",
    channel_name: "daily",
    event_count: "12",
    message_event_count: "9",
    first_event_at: "2026-03-20T08:00:00.000Z",
    last_event_at: "2026-03-20T09:00:00.000Z",
    latest_summary_date: "2026-03-20",
  });

  assert.deepEqual(summary, {
    conversationId: "thread-1",
    threadId: "thread-1",
    channelId: "channel-1",
    guildId: "guild-1",
    label: "daily-check-in",
    threadName: "daily-check-in",
    channelName: "daily",
    eventCount: 12,
    messageEventCount: 9,
    firstEventAt: "2026-03-20T08:00:00.000Z",
    lastEventAt: "2026-03-20T09:00:00.000Z",
    latestSummaryDate: "2026-03-20",
  });
});

test("formatConversationExport builds a readable archive with optional filtering", () => {
  const events = [
    {
      conversation_id: "thread-1",
      channel_id: "channel-1",
      thread_id: "thread-1",
      role: "user",
      author_name: "Georgia",
      event_type: "message",
      content_text: "Morning.",
      metadata: { threadName: "daily-check-in", channelName: "daily" },
      created_at: "2026-03-20T08:00:00.000Z",
    },
    {
      conversation_id: "thread-1",
      channel_id: "channel-1",
      thread_id: "thread-1",
      role: "system",
      author_name: "Cadence",
      event_type: "image_analysis",
      content_text: "A map on the table.",
      metadata: { threadName: "daily-check-in", channelName: "daily" },
      created_at: "2026-03-20T08:01:00.000Z",
    },
    {
      conversation_id: "thread-1",
      channel_id: "channel-1",
      thread_id: "thread-1",
      role: "system",
      author_name: "Cadence",
      event_type: "summary_daily",
      content_text: "Summary text",
      metadata: { threadName: "daily-check-in", channelName: "daily", summaryDate: "2026-03-20" },
      created_at: "2026-03-20T09:00:00.000Z",
    },
  ];

  const headerLines = buildConversationExportHeader(events, {
    conversationId: "thread-1",
    channelId: "channel-1",
    threadId: "thread-1",
    label: "daily-check-in",
  });

  assert.equal(headerLines[0], "# Conversation Export");
  assert.match(headerLines.join("\n"), /Label: daily-check-in/);

  const messagesOnly = formatConversationExport(events, {
    includeHeader: false,
    includeSystem: false,
    includeSummaries: false,
  });

  assert.equal(messagesOnly, "[2026-03-20T08:00:00.000Z] Georgia: Morning.");

  const fullExport = formatConversationExport(events, {
    conversation: {
      conversationId: "thread-1",
      channelId: "channel-1",
      threadId: "thread-1",
      label: "daily-check-in",
    },
  });

  assert.match(fullExport, /# Conversation Export/);
  assert.match(fullExport, /\[image_analysis\] A map on the table\./);
  assert.match(fullExport, /\[summary_daily\] Summary text/);
});

test("resolveConversationScope prefers thread and accepts either thread or channel ids", () => {
  assert.deepEqual(
    resolveConversationScope({
      threadId: "thread-1",
      channelId: "channel-1",
    }),
    {
      conversationId: "thread-1",
      threadId: "thread-1",
      channelId: "channel-1",
    },
  );

  assert.deepEqual(
    resolveConversationScope({
      channelId: "channel-1",
    }),
    {
      conversationId: "channel-1",
      threadId: null,
      channelId: "channel-1",
    },
  );

  assert.deepEqual(
    resolveConversationScope({
      conversationId: "thread-2",
      channelId: "channel-1",
    }),
    {
      conversationId: "thread-2",
      threadId: null,
      channelId: "channel-1",
    },
  );
});

test("conversation history defaults stay pinned to 20", () => {
  assert.equal(DEFAULT_HISTORY_LIMIT, 20);
});
