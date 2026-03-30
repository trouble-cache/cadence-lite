const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildMemoryQueries,
  retrieveMemory,
} = require("../src/chat/pipeline/retrieveMemory");

test("buildMemoryQueries splits primary turn focus from broader continuity context", () => {
  const query = buildMemoryQueries({
    input: {
      content: "testing is perhaps the wrong word",
    },
    mode: {
      name: "default",
    },
    recentUserMessages: [
      "I spent ages importing your memories.",
      "I think the retrieval is finally alive.",
    ],
  });

  assert.match(query.primary, /Current user message:\ntesting is perhaps the wrong word/);
  assert.match(query.primary, /Mode: default/);
  assert.doesNotMatch(query.primary, /Recent user context:/);
  assert.match(query.continuity, /Recent user context:\n1\. I spent ages importing your memories\./);
  assert.match(query.continuity, /2\. I think the retrieval is finally alive\./);
  assert.match(query.continuity, /Mode: default/);
  assert.doesNotMatch(query.continuity, /Channel ID:/);
});

test("retrieveMemory sends layered memory queries with current-turn priority", async () => {
  const queries = [];
  const memory = {
    async retrieve(params) {
      queries.push(params.query);
      return [];
    },
  };

  const message = {
    id: "msg-3",
    guildId: "guild-1",
    channelId: "channel-1",
    channel: {
      messages: {
        async fetch() {
          return [
            {
              id: "msg-1",
              content: "First user note",
              createdTimestamp: 1,
              author: { bot: false },
            },
            {
              id: "msg-2",
              content: "Second user note",
              createdTimestamp: 2,
              author: { bot: false },
            },
            {
              id: "msg-4",
              content: "Bot filler",
              createdTimestamp: 3,
              author: { bot: true },
            },
          ];
        },
      },
    },
  };

  await retrieveMemory({
    memory,
    message,
    input: {
      authorId: "georgia",
      content: "Third user note",
    },
    mode: {
      name: "default",
    },
  });

  assert.equal(queries.length, 1);
  assert.match(queries[0].primary, /Current user message:\nThird user note/);
  assert.doesNotMatch(queries[0].primary, /First user note/);
  assert.match(queries[0].continuity, /Current user message:\nThird user note/);
  assert.match(queries[0].continuity, /1\. First user note/);
  assert.match(queries[0].continuity, /2\. Second user note/);
});
