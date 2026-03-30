const test = require("node:test");
const assert = require("node:assert/strict");

const { buildReply } = require("../src/chat/pipeline/buildReply");

test("buildReply returns provider text for non-placeholder providers", () => {
  const reply = buildReply({
    mode: { name: "daily" },
    input: { content: "hello" },
    recentHistory: [],
    memories: [],
    modelOutput: {
      provider: "openrouter",
      text: "A proper reply.",
    },
  });

  assert.deepEqual(reply, {
    content: "A proper reply.",
    suppressEmbeds: false,
  });
});

test("buildReply suppresses embeds for web search replies", () => {
  const reply = buildReply({
    mode: { name: "default" },
    input: { content: "hello" },
    recentHistory: [],
    memories: [],
    modelOutput: {
      provider: "openai",
      text: "Here's the answer.",
      sources: [{ title: "OpenAI", url: "https://openai.com" }],
      webSearchUsed: true,
    },
  });

  assert.deepEqual(reply, {
    content: "Here's the answer.",
    suppressEmbeds: true,
  });
});
