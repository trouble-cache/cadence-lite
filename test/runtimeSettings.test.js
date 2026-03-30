const test = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeRuntimeSettings,
  applyRuntimeSettings,
  extractRuntimeSettings,
} = require("../src/config/runtimeSettings");

test("normalizeRuntimeSettings keeps only editable keys", () => {
  const normalized = normalizeRuntimeSettings({
    "llm.chat.model": " gpt-5.4 ",
    "chat.historyLimit": " 16 ",
    "chat.timezone": " GMT+1 ",
    "chat.includeTimeContext": false,
    "chat.promptBlocks.personaName": " Cadence ",
    "not.real": "ignore me",
  });

  assert.deepEqual(normalized, {
    "llm.chat.model": "gpt-5.4",
    "chat.historyLimit": 16,
    "chat.timezone": "Etc/GMT-1",
    "chat.includeTimeContext": false,
    "chat.promptBlocks.personaName": "Cadence",
  });
});

test("applyRuntimeSettings updates the live config shape", () => {
  const config = {
    chat: {
      historyLimit: 20,
      timezone: "UTC",
      includeTimeContext: true,
      placeholderModel: "gpt-5.4",
      promptBlocks: {
        personaName: "Cadence",
        userName: "Georgia",
      },
    },
    llm: {
      chatModel: "gpt-5.4",
      imageModel: "gpt-4o",
      chat: {
        provider: "openrouter",
        model: "gpt-5.4",
      },
      image: {
        provider: "openrouter",
        model: "gpt-4o",
      },
    },
  };

  applyRuntimeSettings(config, {
    "llm.chat.model": "gpt-5.5",
    "chat.historyLimit": 18,
    "chat.timezone": "Europe/London",
    "chat.includeTimeContext": false,
    "chat.promptBlocks.userName": "User",
  });

  assert.equal(config.llm.chatModel, "gpt-5.5");
  assert.equal(config.llm.chat.provider, "openrouter");
  assert.equal(config.llm.chat.model, "gpt-5.5");
  assert.equal(config.llm.image.provider, "openrouter");
  assert.equal(config.chat.placeholderModel, "gpt-5.5");
  assert.equal(config.chat.historyLimit, 18);
  assert.equal(config.chat.timezone, "Europe/London");
  assert.equal(config.chat.includeTimeContext, false);
  assert.equal(config.chat.promptBlocks.userName, "User");
});

test("extractRuntimeSettings reads the editable values back out", () => {
  const settings = extractRuntimeSettings({
    chat: {
      historyLimit: 12,
      timezone: "Europe/London",
      includeTimeContext: false,
      promptBlocks: {
        personaName: "Lex",
        userName: "Georgia",
        personaProfile: "Dry, warm, loyal.",
        toneGuidelines: "Restrained and human.",
        userProfile: "Reflective builder.",
        companionPurpose: "Conversation and continuity.",
        boundaryRules: "No Pineapples.",
      },
    },
    llm: {
      chat: {
        provider: "openrouter",
        model: "gpt-5.4",
      },
    },
  });

  assert.equal(settings["llm.chat.model"], "gpt-5.4");
  assert.equal(settings["chat.historyLimit"], 12);
  assert.equal(settings["chat.timezone"], "Europe/London");
  assert.equal(settings["chat.includeTimeContext"], false);
  assert.equal(settings["chat.promptBlocks.personaName"], "Lex");
  assert.equal(settings["chat.promptBlocks.boundaryRules"], "No Pineapples.");
});
