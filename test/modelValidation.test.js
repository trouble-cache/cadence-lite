const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildModelsUserUrl,
  getChangedModelSettings,
  formatModelValidationError,
  planSettingsSave,
  splitSettingsByKeys,
  validateChangedModelSettings,
} = require("../src/llm/modelValidation");

test("buildModelsUserUrl preserves the OpenRouter api path", () => {
  assert.equal(
    buildModelsUserUrl("https://openrouter.ai/api/v1"),
    "https://openrouter.ai/api/v1/models/user",
  );
  assert.equal(
    buildModelsUserUrl("https://eu.openrouter.ai/api/v1/"),
    "https://eu.openrouter.ai/api/v1/models/user",
  );
});

test("getChangedModelSettings only returns changed non-empty model slugs", () => {
  const changed = getChangedModelSettings(
    {
      llm: {
        chat: { model: "openai/gpt-5.4" },
        image: { model: "openai/gpt-5.4-mini" },
        embedding: { model: "openai/text-embedding-3-small" },
        transcription: { model: "google/gemini-2.5-flash" },
      },
    },
    {
      "llm.chat.model": "anthropic/claude-opus-4.6",
      "llm.image.model": "openai/gpt-5.4-mini",
      "llm.embedding.model": "",
      "llm.transcription.model": "google/gemini-2.5-flash",
    },
  );

  assert.deepEqual(changed, [
    {
      key: "llm.chat.model",
      label: "Chat",
      currentValue: "openai/gpt-5.4",
      nextValue: "anthropic/claude-opus-4.6",
    },
  ]);
});

test("splitSettingsByKeys separates model settings from the rest", () => {
  const result = splitSettingsByKeys(
    {
      "llm.chat.model": "openai/gpt-5.4",
      "chat.historyLimit": 22,
    },
    ["llm.chat.model"],
  );

  assert.deepEqual(result.selected, {
    "llm.chat.model": "openai/gpt-5.4",
  });
  assert.deepEqual(result.remainder, {
    "chat.historyLimit": 22,
  });
});

test("validateChangedModelSettings flags models filtered out for the current key", async () => {
  const requests = [];
  const result = await validateChangedModelSettings({
    config: {
      llm: {
        apiKey: "openrouter-key",
        baseURL: "https://openrouter.ai/api/v1",
        chat: { model: "openai/gpt-5.4" },
      },
    },
    settings: {
      "llm.chat.model": "anthropic/claude-opus-4.6",
    },
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return {
        ok: true,
        async json() {
          return {
            data: [
              { id: "openai/gpt-5.4" },
              { id: "google/gemini-2.5-flash" },
            ],
          };
        },
      };
    },
    logger: {
      warn() {},
    },
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "https://openrouter.ai/api/v1/models/user");
  assert.equal(requests[0].options.headers.Authorization, "Bearer openrouter-key");
  assert.equal(result.checked, true);
  assert.deepEqual(result.invalidModels, [
    {
      key: "llm.chat.model",
      label: "Chat",
      currentValue: "openai/gpt-5.4",
      nextValue: "anthropic/claude-opus-4.6",
    },
  ]);
  assert.match(formatModelValidationError(result.invalidModels), /Chat: anthropic\/claude-opus-4\.6/);
});

test("validateChangedModelSettings returns a soft warning when lookup fails", async () => {
  const result = await validateChangedModelSettings({
    config: {
      llm: {
        apiKey: "openrouter-key",
        baseURL: "https://openrouter.ai/api/v1",
        chat: { model: "openai/gpt-5.4" },
      },
    },
    settings: {
      "llm.chat.model": "anthropic/claude-opus-4.6",
    },
    fetchImpl: async () => {
      throw new Error("OpenRouter is having a moment");
    },
    logger: {
      warn() {},
    },
  });

  assert.equal(result.checked, false);
  assert.equal(result.reason, "validation_lookup_failed");
  assert.match(result.message, /could not be checked/i);
  assert.match(result.message, /OpenRouter is having a moment/);
});

test("planSettingsSave preserves non-model changes when a changed model is unavailable", async () => {
  const savePlan = await planSettingsSave({
    config: {
      chat: {
        historyLimit: 20,
        timezone: "UTC",
      },
      llm: {
        apiKey: "openrouter-key",
        baseURL: "https://openrouter.ai/api/v1",
        chat: { model: "openai/gpt-5.4" },
        image: { model: "openai/gpt-5.4-mini" },
        embedding: { model: "openai/text-embedding-3-small" },
        transcription: { model: "google/gemini-2.5-flash" },
      },
    },
    settings: {
      "llm.chat.model": "anthropic/claude-opus-4.6",
      "llm.image.model": "openai/gpt-5.4-mini",
      "llm.embedding.model": "openai/text-embedding-3-small",
      "llm.transcription.model": "google/gemini-2.5-flash",
      "chat.historyLimit": 12,
      "chat.timezone": "Europe/London",
    },
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return {
          data: [
            { id: "openai/gpt-5.4" },
            { id: "openai/gpt-5.4-mini" },
            { id: "openai/text-embedding-3-small" },
            { id: "google/gemini-2.5-flash" },
          ],
        };
      },
    }),
    logger: {
      warn() {},
    },
  });

  assert.deepEqual(savePlan.settingsToPersist, {
    "chat.historyLimit": 12,
    "chat.timezone": "Europe/London",
  });
  assert.equal(savePlan.successMessage, "Saved Lite settings, but left invalid model changes unchanged.");
  assert.match(savePlan.errorMessage, /Chat: anthropic\/claude-opus-4\.6/);
  assert.deepEqual(savePlan.validation.invalidModels, [
    {
      key: "llm.chat.model",
      label: "Chat",
      currentValue: "openai/gpt-5.4",
      nextValue: "anthropic/claude-opus-4.6",
    },
  ]);
});
