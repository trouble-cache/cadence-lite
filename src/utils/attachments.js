function classifyAttachment(attachment) {
  const contentType = attachment.contentType || "";
  const name = (attachment.name || "").toLowerCase();

  if (contentType.startsWith("image/")) {
    return "image";
  }

  if (contentType.startsWith("audio/")) {
    return "audio";
  }

  if (contentType === "application/pdf" || name.endsWith(".pdf")) {
    return "document";
  }

  if (contentType.startsWith("text/") || name.endsWith(".txt") || name.endsWith(".md")) {
    return "document";
  }

  return "file";
}

function normalizeAttachments(attachments) {
  if (!attachments?.size) {
    return [];
  }

  return Array.from(attachments.values()).map((attachment) => ({
    id: attachment.id,
    name: attachment.name || null,
    url: attachment.url,
    contentType: attachment.contentType || null,
    size: attachment.size || 0,
    kind: classifyAttachment(attachment),
  }));
}

function summarizeAttachments(attachments) {
  if (!attachments.length) {
    return "";
  }

  return attachments
    .map((attachment) => {
      if (attachment.name) {
        return `[${attachment.kind} attachment: ${attachment.name}]`;
      }

      return `[${attachment.kind} attachment]`;
    })
    .join(" ");
}

function getInputTypes({ content, attachments }) {
  const inputTypes = new Set();

  if (content?.trim()) {
    inputTypes.add("text");
  }

  for (const attachment of attachments) {
    inputTypes.add(attachment.kind);
  }

  return Array.from(inputTypes);
}

module.exports = {
  normalizeAttachments,
  summarizeAttachments,
  getInputTypes,
};
