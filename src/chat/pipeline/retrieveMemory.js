const CONTINUITY_CONTEXT_CHAR_LIMIT = 300;

function buildQuerySections({ input, mode, recentUserContext = "", includeRecentContext = true }) {
  const parts = [];

  if (input.content?.trim()) {
    parts.push(`Current user message:\n${input.content.trim()}`);
  }

  if (includeRecentContext && recentUserContext) {
    parts.push(`Recent user context:\n${recentUserContext}`);
  }

  parts.push(`Mode: ${mode.name}`);
  return parts.join("\n\n").trim();
}

function buildMemoryQueries({ input, mode, recentUserContext = "" }) {
  return {
    primary: buildQuerySections({
      input,
      mode,
      recentUserContext,
      includeRecentContext: false,
    }),
    continuity: recentUserContext
      ? buildQuerySections({
        input,
        mode,
        recentUserContext,
        includeRecentContext: true,
      })
      : "",
  };
}

function selectRecentUserMessages(recentHistory = []) {
  return recentHistory
    .filter((item) => item.role === "user" || (!item.role && !item.isBot))
    .map((item) => String(item.content || "").trim())
    .filter(Boolean);
}

function buildRecentUserContext(recentHistory = [], maxChars = CONTINUITY_CONTEXT_CHAR_LIMIT) {
  const recentUserMessages = selectRecentUserMessages(recentHistory);
  const cappedLimit = Math.max(0, Number(maxChars) || 0);

  if (!recentUserMessages.length || cappedLimit === 0) {
    return "";
  }

  const joined = recentUserMessages.join("\n");

  if (joined.length <= cappedLimit) {
    return joined;
  }

  return joined.slice(-cappedLimit).trimStart();
}

async function retrieveMemory({ memory, message, input, mode, recentHistory = [] }) {
  const recentUserContext = buildRecentUserContext(recentHistory);

  return memory.retrieve({
    guildId: message.guildId,
    userId: input.authorId,
    query: buildMemoryQueries({
      input,
      mode,
      recentUserContext,
    }),
    mode: mode.name,
  });
}

module.exports = {
  retrieveMemory,
  buildMemoryQueries,
  buildRecentUserContext,
  CONTINUITY_CONTEXT_CHAR_LIMIT,
  selectRecentUserMessages,
};
