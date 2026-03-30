const test = require("node:test");
const assert = require("node:assert/strict");

function withEnv(overrides, fn) {
  const original = {};

  for (const [key, value] of Object.entries(overrides)) {
    original[key] = process.env[key];

    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return fn();
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test("loadConfig no longer exposes a product tier", () => {
  const { loadConfig } = require("../src/config/env");
  const config = loadConfig();
  assert.equal(config.product, undefined);
});

test("loadConfig supports OpenRouter as the chat provider", () => withEnv({
  LLM_PROVIDER: "openrouter",
  OPENROUTER_API_KEY: "or-key",
  OPENROUTER_BASE_URL: "https://openrouter.ai/api/v1",
  LLM_CHAT_MODEL: "openrouter/sonnet",
}, () => {
  const { loadConfig } = require("../src/config/env");
  const config = loadConfig();

  assert.equal(config.llm.provider, "openrouter");
  assert.equal(config.llm.apiKey, "or-key");
  assert.equal(config.llm.baseURL, "https://openrouter.ai/api/v1");
  assert.equal(config.llm.chatModel, "openrouter/sonnet");
  assert.equal(config.chat.placeholderModel, "openrouter/sonnet");
}));

test("loadConfig supports per-capability providers and models", () => withEnv({
  OPENROUTER_API_KEY: "or-key",
  CHAT_LLM_MODEL: "anthropic/claude-sonnet-4.5",
  IMAGE_LLM_MODEL: "anthropic/claude-sonnet-4.6",
  EMBEDDING_LLM_MODEL: "openai/text-embedding-3-small",
  TRANSCRIPTION_LLM_MODEL: "gpt-4o-mini-transcribe",
}, () => {
  const { loadConfig } = require("../src/config/env");
  const config = loadConfig();

  assert.equal(config.llm.chat.provider, "openrouter");
  assert.equal(config.llm.chat.apiKey, "or-key");
  assert.equal(config.llm.chat.model, "anthropic/claude-sonnet-4.5");

  assert.equal(config.llm.image.provider, "openrouter");
  assert.equal(config.llm.image.apiKey, "or-key");
  assert.equal(config.llm.image.model, "anthropic/claude-sonnet-4.6");

  assert.equal(config.llm.embedding.provider, "openrouter");
  assert.equal(config.llm.embedding.apiKey, "or-key");
  assert.equal(config.llm.embedding.model, "openai/text-embedding-3-small");

  assert.equal(config.llm.transcription.provider, "openrouter");
  assert.equal(config.llm.transcription.apiKey, "or-key");
  assert.equal(config.llm.transcription.model, "gpt-4o-mini-transcribe");
}));
