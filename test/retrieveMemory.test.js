const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildMemoryQueries,
  buildRecentUserContext,
  CONTINUITY_CONTEXT_CHAR_LIMIT,
  retrieveMemory,
  selectRecentUserMessages,
} = require("../src/chat/pipeline/retrieveMemory");

test("buildMemoryQueries splits primary turn focus from broader continuity context", () => {
  const query = buildMemoryQueries({
    input: {
      content: "testing is perhaps the wrong word",
    },
    mode: {
      name: "default",
    },
    recentUserContext: "I spent ages importing your memories.\nI think the retrieval is finally alive.",
  });

  assert.match(query.primary, /Current user message:\ntesting is perhaps the wrong word/);
  assert.match(query.primary, /Mode: default/);
  assert.doesNotMatch(query.primary, /Recent user context:/);
  assert.match(query.continuity, /Recent user context:\nI spent ages importing your memories\./);
  assert.match(query.continuity, /I think the retrieval is finally alive\./);
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
    recentHistory: [
      {
        id: "msg-1",
        role: "user",
        content: "First user note",
      },
      {
        id: "msg-2",
        role: "user",
        content: "Second user note",
      },
      {
        id: "msg-4",
        role: "assistant",
        content: "Bot filler",
      },
    ],
  });

  assert.equal(queries.length, 1);
  assert.match(queries[0].primary, /Current user message:\nThird user note/);
  assert.doesNotMatch(queries[0].primary, /First user note/);
  assert.match(queries[0].continuity, /Current user message:\nThird user note/);
  assert.match(queries[0].continuity, /Recent user context:\nFirst user note\nSecond user note/);
});

test("selectRecentUserMessages keeps only user turns from scoped history", () => {
  assert.deepEqual(
    selectRecentUserMessages([
      { role: "user", content: "First user note" },
      { role: "assistant", content: "Assistant filler" },
      { isBot: false, content: "Second user note" },
      { role: "system", content: "System note" },
    ]),
    ["First user note", "Second user note"],
  );
});

test("buildRecentUserContext keeps only the trailing continuity window", () => {
  const userHistory = [
    { role: "user", content: "A".repeat(180) },
    { role: "user", content: "B".repeat(180) },
  ];

  const context = buildRecentUserContext(userHistory, 300);

  assert.equal(context.length, 300);
  assert.doesNotMatch(context, /^A{180}/);
  assert.match(context, /B{180}$/);
});

test("buildRecentUserContext uses the default continuity cap", () => {
  const context = buildRecentUserContext([
    { role: "user", content: "x".repeat(CONTINUITY_CONTEXT_CHAR_LIMIT + 25) },
  ]);

  assert.equal(context.length, CONTINUITY_CONTEXT_CHAR_LIMIT);
});
