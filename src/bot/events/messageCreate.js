const { DEFAULT_CHAT_MODE } = require("../../chat/defaultMode");

const DISCORD_MESSAGE_MAX_LENGTH = 2000;

function splitTextIntoChunks(text, maxLength = DISCORD_MESSAGE_MAX_LENGTH) {
  const normalizedText = String(text || "").trim();

  if (!normalizedText) {
    return [];
  }

  if (normalizedText.length <= maxLength) {
    return [normalizedText];
  }

  const chunks = [];
  const paragraphs = normalizedText.split("\n\n");
  let currentChunk = "";

  function pushCurrentChunk() {
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
      currentChunk = "";
    }
  }

  function appendSegment(segment) {
    if (!segment) {
      return;
    }

    if (!currentChunk) {
      currentChunk = segment;
      return;
    }

    const candidate = `${currentChunk}\n\n${segment}`;

    if (candidate.length <= maxLength) {
      currentChunk = candidate;
      return;
    }

    pushCurrentChunk();
    currentChunk = segment;
  }

  function splitOversizedSegment(segment) {
    if (segment.length <= maxLength) {
      appendSegment(segment);
      return;
    }

    const lines = segment.split("\n");
    let lineChunk = "";

    function pushLineChunk() {
      if (lineChunk.trim()) {
        chunks.push(lineChunk.trim());
        lineChunk = "";
      }
    }

    for (const line of lines) {
      if (line.length > maxLength) {
        pushLineChunk();

        for (let index = 0; index < line.length; index += maxLength) {
          chunks.push(line.slice(index, index + maxLength));
        }

        continue;
      }

      if (!lineChunk) {
        lineChunk = line;
        continue;
      }

      const candidate = `${lineChunk}\n${line}`;

      if (candidate.length <= maxLength) {
        lineChunk = candidate;
      } else {
        pushLineChunk();
        lineChunk = line;
      }
    }

    pushLineChunk();
  }

  for (const paragraph of paragraphs) {
    if (paragraph.length > maxLength) {
      pushCurrentChunk();
      splitOversizedSegment(paragraph);
      continue;
    }

    appendSegment(paragraph);
  }

  pushCurrentChunk();
  return chunks;
}

function createMessageCreateHandler({ config, logger, chatPipeline, conversations }) {
  return async (message) => {
    if (message.author.bot || !message.inGuild() || message.system) {
      return;
    }

    if (config.discord.allowedChannelId && message.channelId !== config.discord.allowedChannelId) {
      return;
    }

    const botUserId = message.client.user?.id;
    const wasMentioned = Boolean(botUserId && message.mentions.users.has(botUserId));
    const conversationId = message.channel.isThread?.() ? message.channel.id : message.channelId;
    const authorName = message.member?.displayName || message.author.globalName || message.author.username;

    if (config.discord.respondToMentionsOnly && !wasMentioned) {
      return;
    }

    let typingInterval = null;

    try {
      logger.info("[chat] New message received", {
        guildId: message.guildId,
        channelId: message.channelId,
        conversationId,
        threadId: message.channel.isThread?.() ? message.channel.id : null,
        messageId: message.id,
        authorId: message.author.id,
        authorName,
        mentionedBot: wasMentioned,
      });

      try {
        await conversations.recordEvent({
          message,
          role: "user",
          source: "discord",
          eventType: "message",
          contentText: message.content,
          authorName,
          metadata: {
            mentionedBot: wasMentioned,
          },
        });
      } catch (error) {
        logger.error("[storage] Failed to persist inbound Discord message", {
          messageId: message.id,
          channelId: message.channelId,
          conversationId,
          error: error.message,
        }, error);
      }

      await message.channel.sendTyping();
      typingInterval = setInterval(() => {
        message.channel.sendTyping().catch((error) => {
          logger.warn("[chat] Failed to refresh typing indicator", {
            channelId: message.channelId,
            conversationId,
            error: error.message,
          });
        });
      }, 8000);

      const mode = DEFAULT_CHAT_MODE;
      const reply = await chatPipeline.run({
        message,
        mode,
        wasMentioned,
      });

      if (!reply) {
        logger.warn("[chat] Message produced no reply", {
          messageId: message.id,
          channelId: message.channelId,
          conversationId,
        });
        return;
      }

      const replyPayload = typeof reply === "string"
        ? { content: reply, suppressEmbeds: false }
        : {
          content: String(reply.content || "").trim(),
          suppressEmbeds: Boolean(reply.suppressEmbeds),
        };
      const replyChunks = splitTextIntoChunks(replyPayload.content);
      let sentReply = null;

      for (const chunk of replyChunks) {
        sentReply = await message.channel.send({
          content: chunk,
          flags: replyPayload.suppressEmbeds ? ["SuppressEmbeds"] : undefined,
        });
      }

      try {
        const persistedReplyText = replyChunks.join("\n\n");
        const replyAuthorName =
          sentReply.member?.displayName ||
          sentReply.author?.globalName ||
          sentReply.author?.username ||
          "Cadence";

        await conversations.recordEvent({
          message: sentReply,
          role: "assistant",
          source: "discord",
          eventType: "message",
          contentText: persistedReplyText,
          authorName: replyAuthorName,
          metadata: {
            inReplyToMessageId: message.id,
            mode: mode.name,
            chunkCount: replyChunks.length,
          },
        });
      } catch (error) {
        logger.error("[storage] Failed to persist outbound Discord message", {
          messageId: sentReply.id,
          channelId: sentReply.channelId,
          conversationId,
          error: error.message,
        }, error);
      }

      logger.info("[chat] Reply sent", {
        messageId: message.id,
        channelId: message.channelId,
        conversationId,
        authorName,
        replyLength: replyPayload.content.length,
        chunkCount: replyChunks.length,
      });
    } catch (error) {
      logger.error("[chat] Failed to process chat message", {
        messageId: message.id,
        channelId: message.channelId,
        conversationId,
        error: error.message,
      }, error);
      await message.channel.send({
        content: "I hit an error while processing that message.",
      });
    } finally {
      if (typingInterval) {
        clearInterval(typingInterval);
      }
    }
  };
}

module.exports = {
  createMessageCreateHandler,
  splitTextIntoChunks,
};
