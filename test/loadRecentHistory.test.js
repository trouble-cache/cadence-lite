const test = require("node:test");
const assert = require("node:assert/strict");

const {
  loadRecentHistory,
} = require("../src/chat/pipeline/loadRecentHistory");

test("loadRecentHistory prefers stored conversation history and excludes the current turn", async () => {
  const history = await loadRecentHistory({
    message: {
      id: "msg-2",
      channelId: "thread-1",
      channel: {
        id: "thread-1",
        isThread: () => true,
      },
    },
    limit: 2,
    conversations: {
      async listRecentHistoryByConversationId(params) {
        assert.equal(params.threadId, "thread-1");
        assert.equal(params.channelId, "thread-1");
        assert.equal(params.limit, 3);

        return [
          { id: "msg-1", role: "user", content: "First note" },
          { id: "msg-2", role: "user", content: "Current note" },
          { id: "msg-3", role: "assistant", content: "Reply note" },
        ];
      },
    },
  });

  assert.deepEqual(history, [
    { id: "msg-1", role: "user", content: "First note" },
    { id: "msg-3", role: "assistant", content: "Reply note" },
  ]);
});

test("loadRecentHistory uses the latest stored conversation slice rather than the oldest", async () => {
  const capturedConversationIds = [];
  const history = await loadRecentHistory({
    message: {
      id: "msg-99",
      channelId: "thread-1",
      channel: {
        id: "thread-1",
        isThread: () => true,
      },
    },
    limit: 2,
    conversations: {
      async listRecentHistoryByConversationId(params) {
        capturedConversationIds.push(params);
        return [
          { id: "msg-98", role: "user", content: "Very recent note" },
          { id: "msg-99", role: "user", content: "Current note" },
          { id: "msg-100", role: "assistant", content: "Very recent reply" },
        ];
      },
    },
  });

  assert.equal(capturedConversationIds.length, 1);
  assert.deepEqual(history, [
    { id: "msg-98", role: "user", content: "Very recent note" },
    { id: "msg-100", role: "assistant", content: "Very recent reply" },
  ]);
});

test("loadRecentHistory falls back to live channel history when no conversation store is available", async () => {
  const history = await loadRecentHistory({
    message: {
      id: "msg-2",
      channelId: "channel-1",
      channel: {
        isThread: () => false,
        messages: {
          async fetch({ limit }) {
            assert.equal(limit, 3);

            return [
              {
                id: "msg-1",
                content: "First note",
                createdTimestamp: 1,
                author: { id: "user-1", username: "Georgia", bot: false },
                member: { displayName: "Georgia" },
                attachments: new Map(),
              },
              {
                id: "msg-2",
                content: "Current note",
                createdTimestamp: 2,
                author: { id: "user-1", username: "Georgia", bot: false },
                member: { displayName: "Georgia" },
                attachments: new Map(),
              },
              {
                id: "msg-3",
                content: "Reply note",
                createdTimestamp: 3,
                author: { id: "bot-1", username: "Cadence", bot: true },
                member: { displayName: "Cadence" },
                attachments: new Map(),
              },
            ];
          },
        },
      },
    },
    limit: 2,
  });

  assert.deepEqual(
    history.map((item) => ({
      id: item.id,
      content: item.content,
      authorName: item.authorName,
      isBot: item.isBot,
    })),
    [
      {
        id: "msg-1",
        content: "First note",
        authorName: "Georgia",
        isBot: false,
      },
      {
        id: "msg-3",
        content: "Reply note",
        authorName: "Cadence",
        isBot: true,
      },
    ],
  );
});

test("loadRecentHistory falls back to live channel history when stored history is empty", async () => {
  const history = await loadRecentHistory({
    message: {
      id: "msg-2",
      channelId: "channel-1",
      channel: {
        isThread: () => false,
        messages: {
          async fetch({ limit }) {
            assert.equal(limit, 3);

            return [
              {
                id: "msg-1",
                content: "First note",
                createdTimestamp: 1,
                author: { id: "user-1", username: "Georgia", bot: false },
                member: { displayName: "Georgia" },
                attachments: new Map(),
              },
              {
                id: "msg-2",
                content: "Current note",
                createdTimestamp: 2,
                author: { id: "user-1", username: "Georgia", bot: false },
                member: { displayName: "Georgia" },
                attachments: new Map(),
              },
              {
                id: "msg-3",
                content: "Reply note",
                createdTimestamp: 3,
                author: { id: "bot-1", username: "Cadence", bot: true },
                member: { displayName: "Cadence" },
                attachments: new Map(),
              },
            ];
          },
        },
      },
    },
    limit: 2,
    conversations: {
      async listRecentHistoryByConversationId() {
        return [];
      },
    },
  });

  assert.deepEqual(
    history.map((item) => ({
      id: item.id,
      content: item.content,
      authorName: item.authorName,
      isBot: item.isBot,
    })),
    [
      {
        id: "msg-1",
        content: "First note",
        authorName: "Georgia",
        isBot: false,
      },
      {
        id: "msg-3",
        content: "Reply note",
        authorName: "Cadence",
        isBot: true,
      },
    ],
  );
});
