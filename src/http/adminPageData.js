const {
  DURABLE_MEMORY_TYPES,
  normalizeTheme,
  getLiteViewFromPath,
  buildLiteMemoryQueryState,
  buildThemeLinks,
  getMessage,
  getError,
} = require("./adminUi");

function sortLiteMemories(memories, sortKey = "updatedAt", sortDirection = "desc") {
  const directionMultiplier = sortDirection === "asc" ? 1 : -1;

  return [...memories].sort((left, right) => {
    let comparison = 0;

    if (sortKey === "title") {
      comparison = String(left.title || "").localeCompare(String(right.title || ""), undefined, { sensitivity: "base" });
    } else if (sortKey === "memoryType") {
      comparison = String(left.memoryType || "").localeCompare(String(right.memoryType || ""), undefined, { sensitivity: "base" });
    } else if (sortKey === "domain") {
      comparison = String(left.domain || "").localeCompare(String(right.domain || ""), undefined, { sensitivity: "base" });
    } else {
      const leftTime = Date.parse(left.updatedAt || "") || 0;
      const rightTime = Date.parse(right.updatedAt || "") || 0;
      comparison = leftTime - rightTime;
    }

    if (comparison === 0) {
      comparison = String(left.title || "").localeCompare(String(right.title || ""), undefined, { sensitivity: "base" });
    }

    return comparison * directionMultiplier;
  });
}

async function loadLiteAdminPageData({ url, context }) {
  const theme = normalizeTheme(url.searchParams.get("theme"));
  const themeLinks = buildThemeLinks(url);
  const currentView = getLiteViewFromPath(url.pathname);
  const liteMemoryState = buildLiteMemoryQueryState(url);
  const automationId = String(url.searchParams.get("automation") || "").trim();
  const journalPage = Math.max(1, Number(url.searchParams.get("journalPage")) || 1);
  const journalPageSize = 5;
  const activeFilter = liteMemoryState.active;
  const requestedPage = Number(url.searchParams.get("page")) || 1;
  const page = Math.max(1, requestedPage);
  const pageSize = 10;

  const allMemories = await context.memoryStore.listMemories({
    userScope: context.config.memory.userScope,
    limit: 1000,
    activeOnly: false,
  });

  const durableMemories = allMemories
    .filter((memory) => DURABLE_MEMORY_TYPES.includes(memory.memoryType))
    .filter((memory) => (activeFilter === "archived" ? !memory.active : memory.active))
    .filter((memory) => {
      if (liteMemoryState.memoryType && memory.memoryType !== liteMemoryState.memoryType) {
        return false;
      }

      if (liteMemoryState.domain && memory.domain !== liteMemoryState.domain) {
        return false;
      }

      if (!liteMemoryState.q) {
        return true;
      }

      const haystack = `${memory.title}\n${memory.content}`.toLowerCase();
      return haystack.includes(liteMemoryState.q.toLowerCase());
    });

  const sortedDurableMemories = sortLiteMemories(
    durableMemories,
    liteMemoryState.sort,
    liteMemoryState.direction,
  );
  const totalMemories = sortedDurableMemories.length;
  const startIndex = (page - 1) * pageSize;
  const memories = sortedDurableMemories.slice(startIndex, startIndex + pageSize);
  const editId = url.searchParams.get("edit") || "";
  const editCandidate = editId
    ? await context.memoryStore.getMemoryById(editId, {
      userScope: context.config.memory.userScope,
    })
    : null;
  const editingMemory = editCandidate && DURABLE_MEMORY_TYPES.includes(editCandidate.memoryType)
    ? editCandidate
    : null;
  const automations = currentView === "proactive"
    ? await context.automationStore.listAutomations({
      userScope: context.config.memory.userScope,
    })
    : [];
  let conversationStorage = null;

  if (currentView === "settings") {
    try {
      conversationStorage = await context.conversations.getStorageStats({
        guildId: context.config.discord.guildId || "",
      });
    } catch (error) {
      context.logger.warn("[admin] Failed to load conversation storage stats", {
        error: error?.message || String(error),
      });
    }
  }

  const totalJournalEntries = currentView === "proactive"
    ? await context.journalStore.countEntries({
      userScope: context.config.memory.userScope,
    })
    : 0;
  const journalEntries = currentView === "proactive"
    ? await context.journalStore.listRecentEntries({
      userScope: context.config.memory.userScope,
      limit: journalPageSize,
      offset: (journalPage - 1) * journalPageSize,
    })
    : [];
  const editingAutomation = currentView === "proactive" && automationId
    ? await context.automationStore.getAutomationById(automationId, {
      userScope: context.config.memory.userScope,
    })
    : null;

  return {
    theme,
    themeLinks,
    currentView,
    activeFilter,
    page,
    pageSize,
    totalMemories,
    searchQuery: liteMemoryState.q,
    memoryTypeFilter: liteMemoryState.memoryType,
    domainFilter: liteMemoryState.domain,
    sortKey: liteMemoryState.sort,
    sortDirection: liteMemoryState.direction,
    memories,
    editingMemory,
    automations,
    conversationStorage,
    journalEntries,
    editingAutomation,
    journalPage,
    journalTotalPages: Math.max(1, Math.ceil(totalJournalEntries / journalPageSize)),
    message: getMessage(url),
    error: getError(url),
  };
}

module.exports = {
  loadLiteAdminPageData,
};
