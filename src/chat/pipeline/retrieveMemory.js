function buildQuerySections({ input, mode, recentUserMessages, includeRecentContext = true }) {
  const parts = [];

  if (input.content?.trim()) {
    parts.push(`Current user message:\n${input.content.trim()}`);
  }

  if (includeRecentContext && recentUserMessages.length) {
    parts.push(
      [
        "Recent user context:",
        ...recentUserMessages.map((item, index) => `${index + 1}. ${item}`),
      ].join("\n"),
    );
  }

  parts.push(`Mode: ${mode.name}`);
  return parts.join("\n\n").trim();
}

function buildMemoryQueries({ input, mode, recentUserMessages }) {
  return {
    primary: buildQuerySections({
      input,
      mode,
      recentUserMessages,
      includeRecentContext: false,
    }),
    continuity: recentUserMessages.length
      ? buildQuerySections({
        input,
        mode,
        recentUserMessages,
        includeRecentContext: true,
      })
      : "",
  };
}

async function retrieveMemory({ memory, message, input, mode }) {
  const fetchLimit = 8;
  const recentMessages = await message.channel.messages.fetch({ limit: fetchLimit });
  const recentUserMessages = recentMessages
    .filter((item) => item.id !== message.id && !item.author?.bot && item.content?.trim())
    .sort((left, right) => left.createdTimestamp - right.createdTimestamp)
    .map((item) => item.content.trim())
    .slice(-2);

  return memory.retrieve({
    guildId: message.guildId,
    userId: input.authorId,
    query: buildMemoryQueries({
      input,
      mode,
      recentUserMessages,
    }),
    mode: mode.name,
  });
}

module.exports = {
  retrieveMemory,
  buildMemoryQueries,
};
