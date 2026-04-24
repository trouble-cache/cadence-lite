const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildConversationEventsCsv,
  buildConversationLogFilename,
  buildConversationLogsIndexCsv,
  buildConversationLogsMetadata,
  createZipBuffer,
} = require("../src/storage/conversations/export");

test("buildConversationEventsCsv exports the expected columns and metadata-derived fields", () => {
  const csv = buildConversationEventsCsv([
    {
      id: 42,
      created_at: "2026-04-24T10:00:00.000Z",
      guild_id: "guild-1",
      author_name: "Georgia",
      source: "discord",
      content_text: "hello, \"there\"",
      metadata: {
        channelName: "general",
        threadName: "daily check-in",
        inputTypes: ["text", "image"],
        attachmentCount: 2,
      },
    },
  ]);

  const lines = csv.split("\n");
  assert.equal(
    lines[0],
    "id,created_at,guild_id,author_name,source,content_text,channel_name,thread_name,input_types,attachment_count",
  );
  assert.match(lines[1], /^42,2026-04-24T10:00:00\.000Z,guild-1,Georgia,discord,"hello, ""there""",general,daily check-in,"text, image",2$/);
});

test("buildConversationLogFilename creates safe filenames and deduplicates collisions", () => {
  const used = new Set();
  const first = buildConversationLogFilename({
    conversationId: "Thread 1",
    label: "Daily Check-in!!!",
    firstEventAt: "2026-04-24T10:00:00.000Z",
  }, used);
  const second = buildConversationLogFilename({
    conversationId: "Thread 1",
    label: "Daily Check-in!!!",
    firstEventAt: "2026-04-24T10:00:00.000Z",
  }, used);

  assert.equal(first, "2026-04-24-daily-check-in-thread-1.txt");
  assert.equal(second, "2026-04-24-daily-check-in-thread-1-2.txt");
});

test("buildConversationLogsIndexCsv exports a readable log manifest", () => {
  const csv = buildConversationLogsIndexCsv([
    {
      conversationId: "thread-1",
      label: "daily-check-in",
      filename: "2026-04-24-daily-check-in-thread-1.txt",
      guildId: "guild-1",
      channelId: "channel-1",
      threadId: "thread-1",
      eventCount: 12,
      messageEventCount: 9,
      firstEventAt: "2026-04-24T08:00:00.000Z",
      lastEventAt: "2026-04-24T09:00:00.000Z",
    },
  ]);

  const lines = csv.split("\n");
  assert.equal(
    lines[0],
    "conversation_id,label,filename,guild_id,channel_id,thread_id,event_count,message_event_count,first_event_at,last_event_at",
  );
  assert.match(lines[1], /^thread-1,daily-check-in,2026-04-24-daily-check-in-thread-1\.txt,guild-1,channel-1,thread-1,12,9,2026-04-24T08:00:00\.000Z,2026-04-24T09:00:00\.000Z$/);
});

test("buildConversationLogsMetadata summarizes the archive payload", () => {
  const metadata = buildConversationLogsMetadata({
    generatedAt: "2026-04-24T12:00:00.000Z",
    entries: [
      {
        conversationId: "thread-1",
        label: "daily-check-in",
        filename: "2026-04-24-daily-check-in-thread-1.txt",
        eventCount: 12,
        messageEventCount: 9,
        firstEventAt: "2026-04-24T08:00:00.000Z",
        lastEventAt: "2026-04-24T09:00:00.000Z",
      },
    ],
  });

  assert.equal(metadata.product, "cadence-lite");
  assert.equal(metadata.exportType, "conversation_logs");
  assert.equal(metadata.conversationCount, 1);
  assert.equal(metadata.conversations[0].filename, "2026-04-24-daily-check-in-thread-1.txt");
});

test("createZipBuffer builds a simple zip archive with the expected entries", () => {
  const zip = createZipBuffer([
    {
      name: "logs/example.txt",
      content: "hello there",
      modifiedAt: "2026-04-24T12:00:00.000Z",
    },
    {
      name: "index.csv",
      content: "conversation_id\nthread-1",
      modifiedAt: "2026-04-24T12:00:00.000Z",
    },
  ], {
    now: "2026-04-24T12:00:00.000Z",
  });

  assert.equal(zip.readUInt32LE(0), 0x04034B50);
  const zipText = zip.toString("latin1");
  assert.match(zipText, /logs\/example\.txt/);
  assert.match(zipText, /index\.csv/);
});
