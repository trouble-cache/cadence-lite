const test = require("node:test");
const assert = require("node:assert/strict");

const { analyzeImageAttachment, transcribeAudioAttachment } = require("../src/chat/pipeline/enrichInput");

test("analyzeImageAttachment uses the configured image model", async () => {
  const calls = [];
  const text = await analyzeImageAttachment({
    client: {
      responses: {
        async create(payload) {
          calls.push(payload);
          return {
            output_text: "A moody snowy cabin with warm lamplight.",
          };
        },
      },
    },
    config: {
      llm: {
        imageModel: "openai/gpt-4.1-mini",
      },
      openai: {
        imageModel: "gpt-4o",
      },
    },
    attachment: {
      url: "https://cdn.discordapp.test/cabin.png",
    },
  });

  assert.equal(text, "A moody snowy cabin with warm lamplight.");
  assert.equal(calls[0].model, "openai/gpt-4.1-mini");
  assert.equal(calls[0].input[0].content[1].image_url, "https://cdn.discordapp.test/cabin.png");
});

test("transcribeAudioAttachment sends OpenRouter audio as input_audio chat content", async () => {
  const originalFetch = global.fetch;
  const calls = [];

  global.fetch = async (url) => {
    calls.push(["fetch", url]);
    return {
      ok: true,
      async blob() {
        return new Blob(["voice note bytes"], { type: "audio/ogg" });
      },
    };
  };

  try {
    const text = await transcribeAudioAttachment({
      client: {
        chat: {
          completions: {
            async create(payload) {
              calls.push(["create", payload.model, payload.messages[0].content[1].input_audio.format]);
              return {
                choices: [
                  {
                    message: {
                      content: "hello from openrouter audio",
                    },
                  },
                ],
              };
            },
          },
        },
      },
      config: {
        llm: {
          transcription: {
            provider: "openrouter",
            model: "google/gemini-2.5-flash-lite",
          },
        },
      },
      attachment: {
        url: "https://cdn.discordapp.test/voice.ogg",
        name: "voice-message.ogg",
        contentType: "audio/ogg",
      },
    });

    assert.equal(text, "hello from openrouter audio");
    assert.deepEqual(calls, [
      ["fetch", "https://cdn.discordapp.test/voice.ogg"],
      ["create", "google/gemini-2.5-flash-lite", "ogg"],
    ]);
  } finally {
    global.fetch = originalFetch;
  }
});
