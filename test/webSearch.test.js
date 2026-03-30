const test = require("node:test");
const assert = require("node:assert/strict");

const {
  shouldUseWebSearch,
  buildWebSearchRequestOptions,
  extractWebSearchSources,
} = require("../src/chat/pipeline/webSearch");

test("shouldUseWebSearch triggers on current-info prompts", () => {
  assert.equal(shouldUseWebSearch({
    input: { content: "Can you look up the latest OpenAI news for me?" },
  }), true);

  assert.equal(shouldUseWebSearch({
    input: { content: "Morning. I'm a bit fried today." },
  }), false);
});

test("shouldUseWebSearch can trigger from automation prompt text", () => {
  assert.equal(shouldUseWebSearch({
    input: { content: "Scheduled action: Morning check-in" },
    automation: {
      label: "Morning check-in",
      prompt: "Look up today's weather first, then check in gently.",
    },
  }), true);

  assert.equal(shouldUseWebSearch({
    input: { content: "Scheduled action: Morning check-in" },
    automation: {
      label: "Morning check-in",
      prompt: "Check in gently and ask how the morning is going.",
    },
  }), false);
});

test("buildWebSearchRequestOptions returns OpenRouter plugin config", () => {
  assert.deepEqual(buildWebSearchRequestOptions(), {
    plugins: [{ id: "web" }],
  });
});

test("extractWebSearchSources deduplicates response source urls", () => {
  const sources = extractWebSearchSources({
    output: [
      {
        type: "web_search_call",
        action: {
          sources: [
            { type: "url", title: "OpenAI", url: "https://openai.com" },
            { type: "url", title: "OpenAI duplicate", url: "https://openai.com" },
          ],
        },
      },
      {
        type: "message",
        content: [
          {
            type: "output_text",
            annotations: [
              { type: "url_citation", title: "OpenRouter", url: "https://openrouter.ai" },
            ],
          },
        ],
      },
    ],
  });

  assert.deepEqual(sources, [
    { title: "OpenAI", url: "https://openai.com" },
    { title: "OpenRouter", url: "https://openrouter.ai" },
  ]);
});
