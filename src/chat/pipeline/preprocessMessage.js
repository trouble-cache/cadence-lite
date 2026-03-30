const { normalizeAttachments, summarizeAttachments, getInputTypes } = require("../../utils/attachments");

function preprocessMessage({ message, botUserId }) {
  let content = message.content.trim();

  if (botUserId) {
    const mentionPattern = new RegExp(`<@!?${botUserId}>`, "g");
    content = content.replace(mentionPattern, "").trim();
  }

  const attachments = normalizeAttachments(message.attachments);
  const attachmentSummary = summarizeAttachments(attachments);

  if (!content && attachmentSummary) {
    content = attachmentSummary;
  }

  return {
    content,
    authorId: message.author.id,
    authorName: message.member?.displayName || message.author.globalName || message.author.username,
    channelId: message.channelId,
    messageId: message.id,
    messageTimestamp: message.createdAt.toISOString(),
    attachments,
    inputTypes: getInputTypes({ content, attachments }),
  };
}

module.exports = {
  preprocessMessage,
};
