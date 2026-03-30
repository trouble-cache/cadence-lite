const test = require("node:test");
const assert = require("node:assert/strict");

const { embedTexts } = require("../src/memory/embeddings");

test("embedTexts uses the configured embedding model", async () => {
  const calls = [];
  const previousKey = process.env.OPENROUTER_API_KEY;
  process.env.OPENROUTER_API_KEY = "or-key";
  try {
    const vectors = await embedTexts({
      config: {
        llm: {
          embedding: {
            provider: "openrouter",
            model: "openai/text-embedding-3-small",
          },
        },
      },
      inputs: ["alpha", "beta"],
      client: {
        embeddings: {
          async create(payload) {
            calls.push(payload);
            return {
              data: [
                { index: 1, embedding: [0.2, 0.3] },
                { index: 0, embedding: [0.1, 0.2] },
              ],
            };
          },
        },
      },
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].model, "openai/text-embedding-3-small");
    assert.deepEqual(calls[0].input, ["alpha", "beta"]);
    assert.deepEqual(vectors, [[0.1, 0.2], [0.2, 0.3]]);
  } finally {
    process.env.OPENROUTER_API_KEY = previousKey;
  }
});
