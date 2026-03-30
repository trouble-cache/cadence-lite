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
        allowedChannelId: "",
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

test("createMessageCreateHandler passes the default mode into the pipeline", async () => {
  let receivedMode = null;
  const handler = createMessageCreateHandler({
    config: {
      discord: {
        allowedChannelId: "",
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
