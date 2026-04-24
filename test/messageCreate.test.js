const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createMessageCreateHandler,
  splitTextIntoChunks,
} = require("../src/bot/events/messageCreate");

test("splitTextIntoChunks keeps short replies intact", () => {
  assert.deepEqual(splitTextIntoChunks("hello there"), ["hello there"]);
});

test("splitTextIntoChunks prefers paragraph boundaries for long replies", () => {
  const paragraphA = "A".repeat(1200);
  const paragraphB = "B".repeat(1200);
  const chunks = splitTextIntoChunks(`${paragraphA}\n\n${paragraphB}`, 2000);

  assert.equal(chunks.length, 2);
  assert.equal(chunks[0], paragraphA);
  assert.equal(chunks[1], paragraphB);
});

test("splitTextIntoChunks hard-wraps oversized single lines when needed", () => {
  const chunks = splitTextIntoChunks("x".repeat(4500), 2000);

  assert.equal(chunks.length, 3);
  assert.equal(chunks[0].length, 2000);
  assert.equal(chunks[1].length, 2000);
  assert.equal(chunks[2].length, 500);
});

test("createMessageCreateHandler ignores Discord system messages", async () => {
  let wasCalled = false;
  const handler = createMessageCreateHandler({
    config: {
      discord: {
        respondToMentionsOnly: false,
      },
      chat: {},
    },
    logger: {
      debug() {},
      info() {},
      warn() {},
      error() {},
    },
    chatPipeline: {
      async run() {
        wasCalled = true;
        return "should not happen";
      },
    },
    conversations: {
      async recordEvent() {
        wasCalled = true;
      },
    },
  });

  await handler({
    system: true,
    inGuild: () => true,
    author: { bot: false },
  });

  assert.equal(wasCalled, false);
});

test("createMessageCreateHandler logs direct messages before ignoring them", async () => {
  let wasCalled = false;
  const infoLogs = [];
  const handler = createMessageCreateHandler({
    config: {
      discord: {
        respondToMentionsOnly: false,
      },
      chat: {},
    },
    logger: {
      debug() {},
      info(message, meta) {
        infoLogs.push({ message, meta });
      },
      warn() {},
      error() {},
    },
    chatPipeline: {
      async run() {
        wasCalled = true;
        return "should not happen";
      },
    },
    conversations: {
      async recordEvent() {
        wasCalled = true;
      },
    },
  });

  await handler({
    id: "message-dm",
    system: false,
    inGuild: () => false,
    channelId: "dm-1",
    author: { bot: false, id: "user-1", username: "Georgia" },
  });

  assert.equal(wasCalled, false);
  assert.equal(infoLogs.length, 1);
  assert.equal(
    infoLogs[0].message,
    "[chat] Ignoring direct message; Cadence Lite only responds inside the configured Discord server",
  );
  assert.equal(infoLogs[0].meta.authorId, "user-1");
});

test("createMessageCreateHandler logs mention-only skips before ignoring them", async () => {
  let wasCalled = false;
  const infoLogs = [];
  const handler = createMessageCreateHandler({
    config: {
      discord: {
        respondToMentionsOnly: true,
      },
      chat: {},
    },
    logger: {
      debug() {},
      info(message, meta) {
        infoLogs.push({ message, meta });
      },
      warn() {},
      error() {},
    },
    chatPipeline: {
      async run() {
        wasCalled = true;
        return "should not happen";
      },
    },
    conversations: {
      async recordEvent() {
        wasCalled = true;
      },
    },
  });

  await handler({
    id: "message-mention-only",
    system: false,
    inGuild: () => true,
    guildId: "guild-1",
    channelId: "channel-1",
    author: { bot: false, id: "user-1", username: "Georgia" },
    member: { displayName: "Georgia" },
    channel: {
      isThread: () => false,
    },
    mentions: {
      users: {
        has() {
          return false;
        },
      },
    },
    client: {
      user: {
        id: "bot-1",
      },
    },
  });

  assert.equal(wasCalled, false);
  assert.equal(infoLogs.length, 1);
  assert.equal(
    infoLogs[0].message,
    "[chat] Ignoring message because mention-only mode is enabled and the bot was not mentioned",
  );
  assert.equal(infoLogs[0].meta.guildId, "guild-1");
  assert.equal(infoLogs[0].meta.channelId, "channel-1");
});

test("createMessageCreateHandler passes the default mode into the pipeline", async () => {
  let receivedMode = null;
  const handler = createMessageCreateHandler({
    config: {
      discord: {
        respondToMentionsOnly: false,
      },
      chat: {},
    },
    logger: {
      info() {},
      warn() {},
      error() {},
    },
    chatPipeline: {
      async run({ mode }) {
        receivedMode = mode;
        return "hello there";
      },
    },
    conversations: {
      async recordEvent() {},
    },
  });

  await handler({
    id: "message-1",
    system: false,
    inGuild: () => true,
    guildId: "guild-1",
    channelId: "channel-1",
    content: "hello",
    author: { bot: false, id: "user-1", username: "Georgia" },
    member: { displayName: "Georgia" },
    channel: {
      isThread: () => false,
      async sendTyping() {},
      async send(payload) {
        return {
          id: "reply-1",
          channelId: "channel-1",
          author: { username: "Georgia" },
          member: { displayName: "Trouble" },
          ...payload,
        };
      },
    },
    mentions: {
      users: {
        has() {
          return false;
        },
      },
    },
    client: {
      user: {
        id: "bot-1",
      },
    },
  });

  assert.equal(receivedMode.name, "default");
});

test("createMessageCreateHandler processes thread messages", async () => {
  let pipelineRuns = 0;
  const recordedEvents = [];
  const handler = createMessageCreateHandler({
    config: {
      discord: {
        respondToMentionsOnly: false,
      },
      chat: {},
    },
    logger: {
      info() {},
      warn() {},
      error() {},
    },
    chatPipeline: {
      async run() {
        pipelineRuns += 1;
        return "thread reply";
      },
    },
    conversations: {
      async recordEvent(event) {
        recordedEvents.push(event);
      },
    },
  });

  await handler({
    id: "message-2",
    system: false,
    inGuild: () => true,
    guildId: "guild-1",
    channelId: "thread-1",
    content: "hello from a thread",
    author: { bot: false, id: "user-1", username: "Georgia" },
    member: { displayName: "Georgia" },
    channel: {
      id: "thread-1",
      parentId: "channel-1",
      isThread: () => true,
      async sendTyping() {},
      async send(payload) {
        return {
          id: "reply-2",
          channelId: "thread-1",
          guildId: "guild-1",
          author: { username: "Cadence" },
          member: { displayName: "Cadence" },
          channel: this,
          ...payload,
        };
      },
    },
    mentions: {
      users: {
        has() {
          return false;
        },
      },
    },
    client: {
      user: {
        id: "bot-1",
      },
    },
  });

  assert.equal(pipelineRuns, 1);
  assert.equal(recordedEvents.length, 2);
});
