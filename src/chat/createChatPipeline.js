const { preprocessMessage } = require("./pipeline/preprocessMessage");
const { enrichInput } = require("./pipeline/enrichInput");
const { loadRecentHistory } = require("./pipeline/loadRecentHistory");
const { retrieveMemory } = require("./pipeline/retrieveMemory");
const { callModel } = require("./pipeline/callModel");
const { buildReply } = require("./pipeline/buildReply");
const { DEFAULT_CHAT_MODE } = require("./defaultMode");

function createChatPipeline({ config, logger, memory, tools, conversations }) {
  return {
    async run({ message, mode }) {
      const startedAt = Date.now();
      const selectedMode = mode || DEFAULT_CHAT_MODE;
      const preprocessedInput = preprocessMessage({ message, botUserId: message.client.user?.id });
      const input = await enrichInput({ config, logger, input: preprocessedInput });

      if (!input.content) {
        logger.warn("[chat] Ignoring empty message after preprocessing", {
          messageId: message.id,
          channelId: message.channelId,
        });
        return null;
      }

      logger.debug("[chat] Message prepared for the chat pipeline", {
        messageId: message.id,
        channelId: message.channelId,
        contentLength: input.content.length,
        inputTypes: input.inputTypes,
        mode: selectedMode.name,
      });

      for (const derivedAttachment of input.derivedAttachments || []) {
        try {
          await conversations.recordEvent({
            message,
            role: "system",
            source: "cadence",
            eventType: derivedAttachment.kind,
            contentText: derivedAttachment.text,
            metadata: {
              attachment: derivedAttachment.attachment,
              sourceMessageId: message.id,
              model:
                derivedAttachment.kind === "audio_transcription"
                  ? (config.llm?.transcription?.model || config.llm?.transcriptionModel)
                  : (config.llm?.image?.model || config.llm?.imageModel),
            },
          });
        } catch (error) {
          logger.error("[storage] Failed to persist derived attachment event", {
            messageId: message.id,
            kind: derivedAttachment.kind,
            error: error.message,
          }, error);
        }
      }

      const historyLimit = Number.isFinite(config.chat?.historyLimit)
        ? config.chat.historyLimit
        : selectedMode.historyLimit;
      const recentHistory = await loadRecentHistory({ message, limit: historyLimit });
      logger.debug("[chat] Recent chat history loaded", {
        messageId: message.id,
        recentHistoryCount: recentHistory.length,
      });

      const memories = await retrieveMemory({ memory, message, input, mode: selectedMode, logger });
      logger.debug("[chat] Memory retrieval finished", {
        messageId: message.id,
        memoryCount: memories.length,
      });

      const modelOutput = await callModel({
        config,
        logger,
        tools,
        mode: selectedMode,
        message,
        input,
        recentHistory,
        memories,
      });

      const reply = buildReply({ mode: selectedMode, input, recentHistory, memories, modelOutput });

      logger.debug("[chat] Chat pipeline finished", {
        messageId: message.id,
        mode: selectedMode.name,
        provider: modelOutput.provider,
        recentHistoryCount: recentHistory.length,
        memoryCount: memories.length,
        durationMs: Date.now() - startedAt,
      });

      return reply;
    },
  };
}

module.exports = {
  createChatPipeline,
};
