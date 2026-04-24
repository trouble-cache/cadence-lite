const { normalizeAttachments, summarizeAttachments } = require("../../utils/attachments");

function buildMessageContent(message) {
  const parts = [];
  const attachments = normalizeAttachments(message.attachments);

  if (message.content?.trim()) {
    parts.push(message.content.trim());
  }

  if (attachments.length) {
    parts.push(summarizeAttachments(attachments));
  }

  return parts.join(" ").trim();
}

async function loadRecentHistory({ message, limit = 20, conversations }) {
  const storedHistory = await loadRecentHistoryFromConversationStore({
    message,
    limit,
    conversations,
  });

  if (Array.isArray(storedHistory) && storedHistory.length > 0) {
    return storedHistory;
  }

  return loadRecentHistoryFromChannel({ message, limit });
}

async function loadRecentHistoryFromConversationStore({ message, limit = 20, conversations }) {
  if (typeof conversations?.listRecentHistoryByConversationId !== "function") {
    return null;
  }

  const recentHistory = await conversations.listRecentHistoryByConversationId({
    threadId: message.channel?.isThread?.() ? message.channel.id : null,
    channelId: message.channelId,
    limit: Math.max(limit + 1, 2),
  });

  return recentHistory
    .filter((item) => item.id !== message.id)
    .slice(-limit);
}

async function loadRecentHistoryFromChannel({ message, limit = 20 }) {
  const fetchLimit = Math.max(limit + 1, 2);
  const recentMessages = await message.channel.messages.fetch({ limit: fetchLimit });

  return recentMessages
    .filter((item) => item.id !== message.id)
    .sort((left, right) => left.createdTimestamp - right.createdTimestamp)
    .map((item) => ({
      id: item.id,
      authorId: item.author?.id || "",
      authorName: item.member?.displayName || item.author?.globalName || item.author?.username || "unknown",
      isBot: Boolean(item.author?.bot),
      content: buildMessageContent(item),
      attachments: normalizeAttachments(item.attachments),
      createdTimestamp: item.createdTimestamp,
    }))
    .filter((item) => item.content)
    .slice(-limit);
}

module.exports = {
  loadRecentHistory,
  loadRecentHistoryFromConversationStore,
  loadRecentHistoryFromChannel,
};
