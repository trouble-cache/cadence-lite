const test = require("node:test");
const assert = require("node:assert/strict");

const channelIdCommand = require("../src/bot/commands/channelId");
const userIdCommand = require("../src/bot/commands/userId");
const timeContextCommand = require("../src/bot/commands/timeContext");
const { loadCommands } = require("../src/bot/commands");

test("loadCommands only exposes lite helper commands", () => {
  const commands = loadCommands().map((command) => command.data.name);

  assert.deepEqual(commands.includes("mode"), false);
  assert.deepEqual(commands.includes("summarize-thread"), false);
  assert.deepEqual(commands.includes("channel-id"), true);
  assert.deepEqual(commands.includes("user-id"), true);
  assert.deepEqual(commands.includes("time-context"), true);
});

test("/channel-id replies with the current thread and parent IDs", async () => {
  let replyPayload = null;

  await channelIdCommand.execute({
    channelId: "thread-123",
    channel: {
      id: "thread-123",
      parentId: "channel-456",
      isThread() {
        return true;
      },
    },
    async reply(payload) {
      replyPayload = payload;
    },
  });

  assert.match(replyPayload.content, /Current thread ID: `thread-123`/);
  assert.match(replyPayload.content, /Parent channel ID: `channel-456`/);
});

test("/user-id replies with the caller's Discord user ID", async () => {
  let replyPayload = null;

  await userIdCommand.execute({
    user: {
      id: "515631685573017611",
    },
    async reply(payload) {
      replyPayload = payload;
    },
  });

  assert.match(replyPayload.content, /515631685573017611/);
});

test("/time-context off persists the setting and updates live config", async () => {
  let replyPayload = null;
  let savedSettings = null;
  const config = {
    chat: {
      includeTimeContext: true,
    },
  };

  await timeContextCommand.execute({
    client: {
      appContext: {
        config,
        settingsStore: {
          async upsertSettings(settings) {
            savedSettings = settings;
            return settings;
          },
        },
      },
    },
    options: {
      getSubcommand() {
        return "off";
      },
    },
    async reply(payload) {
      replyPayload = payload;
    },
  });

  assert.deepEqual(savedSettings, {
    "chat.includeTimeContext": false,
  });
  assert.equal(config.chat.includeTimeContext, false);
  assert.match(replyPayload.content, /now `off`/);
});
