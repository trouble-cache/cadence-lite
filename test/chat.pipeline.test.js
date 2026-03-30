const test = require("node:test");
const assert = require("node:assert/strict");

test("createChatPipeline persists derived attachment events from enriched input", async () => {
  const pipelinePath = require.resolve("../src/chat/createChatPipeline");
  const enrichInputPath = require.resolve("../src/chat/pipeline/enrichInput");
  const retrieveMemoryPath = require.resolve("../src/chat/pipeline/retrieveMemory");
  const callModelPath = require.resolve("../src/chat/pipeline/callModel");
  const buildReplyPath = require.resolve("../src/chat/pipeline/buildReply");

  const originalEnrichModule = require.cache[enrichInputPath];
  const originalRetrieveModule = require.cache[retrieveMemoryPath];
  const originalCallModelModule = require.cache[callModelPath];
  const originalBuildReplyModule = require.cache[buildReplyPath];
  const originalPipelineModule = require.cache[pipelinePath];

  require.cache[enrichInputPath] = {
    exports: {
      enrichInput: async ({ input }) => ({
        ...input,
        content: `${input.content}\n\n[derived]`,
        derivedAttachments: [
          {
            kind: "audio_transcription",
            text: "Hello from a voice note",
            attachment: { name: "voice.m4a", kind: "audio" },
          },
          {
            kind: "image_analysis",
            text: "A dog wearing a tiny conductor hat",
            attachment: { name: "dog.png", kind: "image" },
          },
        ],
      }),
    },
  };

  require.cache[retrieveMemoryPath] = {
    exports: {
      retrieveMemory: async () => [],
    },
  };

  require.cache[callModelPath] = {
    exports: {
      callModel: async () => ({ provider: "test", text: "stub reply", summary: {} }),
    },
  };

  require.cache[buildReplyPath] = {
    exports: {
      buildReply: () => "stub reply",
    },
  };

  delete require.cache[pipelinePath];
  const { createChatPipeline } = require("../src/chat/createChatPipeline");

  const recordedEvents = [];
  const pipeline = createChatPipeline({
    config: {
      llm: {
        transcriptionModel: "gpt-4o-transcribe",
        imageModel: "gpt-4o",
      },
    },
    logger: {
      debug() {},
      info() {},
      warn() {},
      error() {},
    },
    memory: {},
    tools: { list: () => [] },
    conversations: {
      async recordEvent(event) {
        recordedEvents.push(event);
      },
    },
  });

  const message = {
    id: "msg-1",
    content: "hello there",
    channelId: "channel-1",
    guildId: "guild-1",
    createdAt: new Date("2026-03-20T10:00:00.000Z"),
    client: { user: { id: "bot-1" } },
    author: { id: "user-1", username: "georgia", globalName: "Georgia" },
    member: { displayName: "Georgia" },
    attachments: new Map(),
    channel: {
      isThread: () => false,
      messages: {
        fetch: async () => [],
      },
    },
  };

  try {
    const reply = await pipeline.run({ message });

    assert.equal(reply, "stub reply");
    assert.equal(recordedEvents.length, 2);
    assert.deepEqual(
      recordedEvents.map((event) => ({
        eventType: event.eventType,
        role: event.role,
        source: event.source,
      })),
      [
        {
          eventType: "audio_transcription",
          role: "system",
          source: "cadence",
        },
        {
          eventType: "image_analysis",
          role: "system",
          source: "cadence",
        },
      ],
    );
  } finally {
    if (originalEnrichModule) {
      require.cache[enrichInputPath] = originalEnrichModule;
    } else {
      delete require.cache[enrichInputPath];
    }

    if (originalRetrieveModule) {
      require.cache[retrieveMemoryPath] = originalRetrieveModule;
    } else {
      delete require.cache[retrieveMemoryPath];
    }

    if (originalCallModelModule) {
      require.cache[callModelPath] = originalCallModelModule;
    } else {
      delete require.cache[callModelPath];
    }

    if (originalBuildReplyModule) {
      require.cache[buildReplyPath] = originalBuildReplyModule;
    } else {
      delete require.cache[buildReplyPath];
    }

    if (originalPipelineModule) {
      require.cache[pipelinePath] = originalPipelineModule;
    } else {
      delete require.cache[pipelinePath];
    }
  }
});
