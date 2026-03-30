function renderLiteMemoriesPage({
  config,
  memories = [],
  activeFilter = "active",
  page = 1,
  pageSize = 10,
  totalMemories = 0,
  theme = "light",
  searchQuery = "",
  memoryTypeFilter = "",
  domainFilter = "",
  sortKey = "updatedAt",
  sortDirection = "desc",
  helpers,
}) {
  const {
    canSyncMemories,
    escapeHtml,
    formatDateValue,
    renderOptions,
    buildLiteCategoryOptions,
    buildAdminLocation,
    buildLiteAdminLocation,
    buildLiteMemoryExtras,
    renderIconImage,
    renderConfirmOnSubmit,
    withThemeField,
    DURABLE_MEMORY_TYPES,
    MEMORY_DELETE_CONFIRMATION_MESSAGE,
  } = helpers;
  const categoryOptions = buildLiteCategoryOptions(domainFilter);

  function buildSortLink(nextSortKey) {
    const nextDirection = sortKey === nextSortKey && sortDirection === "asc" ? "desc" : "asc";

    return buildLiteAdminLocation({
      view: "memories",
      theme,
      extra: buildLiteMemoryExtras({
        active: activeFilter,
        q: searchQuery,
        memoryType: memoryTypeFilter,
        domain: domainFilter,
        page: 1,
        sort: nextSortKey,
        direction: nextDirection,
      }),
    });
  }

  function renderSortableHeader(label, key) {
    const isActive = sortKey === key;
    const marker = isActive ? (sortDirection === "asc" ? " ↑" : " ↓") : "";

    return `<a href="${escapeHtml(buildSortLink(key))}" style="color:inherit;text-decoration:none">${escapeHtml(label + marker)}</a>`;
  }

  const syncAvailable = canSyncMemories(config);
  const totalPages = Math.max(1, Math.ceil(totalMemories / pageSize));
  const previousPage = page > 1 ? page - 1 : null;
  const nextPage = page < totalPages ? page + 1 : null;
  const memoryRows = memories.map((memory) => [
    "<tr>",
    "<td>",
    `<p class="memory-title"><a class="memory-title-link" href="${escapeHtml(buildAdminLocation({
      path: "/admin/memories/edit",
      theme,
      extra: buildLiteMemoryExtras({
        active: activeFilter,
        q: searchQuery,
        memoryType: memoryTypeFilter,
        domain: domainFilter,
        page,
        edit: memory.memoryId,
        sort: sortKey,
        direction: sortDirection,
      }),
    }))}">${escapeHtml(memory.title)}</a></p>`,
    `<p class="meta">${escapeHtml(memory.active ? "Active" : "Archived")}</p>`,
    "</td>",
    `<td><div class="memory-content">${escapeHtml(memory.content)}</div></td>`,
    `<td><div class="memory-chip-row"><span class="badge type">${escapeHtml(memory.memoryType)}</span></div></td>`,
    `<td><div class="memory-chip-row"><span class="badge domain">${escapeHtml(memory.domain)}</span></div></td>`,
    `<td class="updated-col">${escapeHtml(formatDateValue(memory.updatedAt))}</td>`,
    "<td class=\"actions-col\">",
    "<div class=\"row-actions\">",
    `<a class="icon-button" href="${escapeHtml(buildAdminLocation({
      path: "/admin/memories/edit",
      theme,
      extra: buildLiteMemoryExtras({
        active: activeFilter,
        q: searchQuery,
        memoryType: memoryTypeFilter,
        domain: domainFilter,
        page,
        edit: memory.memoryId,
        sort: sortKey,
        direction: sortDirection,
      }),
    }))}" aria-label="Edit memory" title="Edit memory">${renderIconImage("edit", theme, "Edit", "table-action-icon")}</a>`,
    "<form method=\"post\" action=\"/admin/actions/memory-archive\">",
    withThemeField(theme),
    "<input type=\"hidden\" name=\"view\" value=\"memories\">",
    `<input type="hidden" name="active" value="${escapeHtml(activeFilter)}">`,
    `<input type="hidden" name="q" value="${escapeHtml(searchQuery)}">`,
    `<input type="hidden" name="memoryTypeFilter" value="${escapeHtml(memoryTypeFilter)}">`,
    `<input type="hidden" name="domainFilter" value="${escapeHtml(domainFilter)}">`,
    `<input type="hidden" name="page" value="${escapeHtml(String(page))}">`,
    `<input type="hidden" name="sort" value="${escapeHtml(sortKey)}">`,
    `<input type="hidden" name="direction" value="${escapeHtml(sortDirection)}">`,
    `<input type="hidden" name="memoryId" value="${escapeHtml(memory.memoryId)}">`,
    `<button type="submit" class="icon-button" aria-label="${escapeHtml(memory.active ? "Archive memory" : "Restore memory")}" title="${escapeHtml(memory.active ? "Archive memory" : "Restore memory")}">${renderIconImage(memory.active ? "archive" : "restore", theme, memory.active ? "Archive" : "Restore", "table-action-icon")}</button>`,
    "</form>",
    `<form method="post" action="/admin/actions/memory-delete"${renderConfirmOnSubmit(MEMORY_DELETE_CONFIRMATION_MESSAGE)}>`,
    withThemeField(theme),
    "<input type=\"hidden\" name=\"view\" value=\"memories\">",
    `<input type="hidden" name="active" value="${escapeHtml(activeFilter)}">`,
    `<input type="hidden" name="q" value="${escapeHtml(searchQuery)}">`,
    `<input type="hidden" name="memoryTypeFilter" value="${escapeHtml(memoryTypeFilter)}">`,
    `<input type="hidden" name="domainFilter" value="${escapeHtml(domainFilter)}">`,
    `<input type="hidden" name="page" value="${escapeHtml(String(page))}">`,
    `<input type="hidden" name="sort" value="${escapeHtml(sortKey)}">`,
    `<input type="hidden" name="direction" value="${escapeHtml(sortDirection)}">`,
    `<input type="hidden" name="memoryId" value="${escapeHtml(memory.memoryId)}">`,
    `<button type="submit" class="icon-button" aria-label="Delete memory" title="Delete memory">${renderIconImage("delete", theme, "Delete", "table-action-icon")}</button>`,
    "</form>",
    "</div>",
    "</td>",
    "</tr>",
  ].join("")).join("");

  return [
    "<section class=\"lite-toolbar stack\">",
    "<div class=\"toolbar-row primary\">",
    "<div class=\"toolbar-group\">",
    `<a class="toolbar-button" href="${escapeHtml(buildAdminLocation({
      path: "/admin/memories/new",
      theme,
      extra: buildLiteMemoryExtras({
        active: activeFilter,
        q: searchQuery,
        memoryType: memoryTypeFilter,
        domain: domainFilter,
        page: 1,
        sort: sortKey,
        direction: sortDirection,
      }),
    }))}">Add New Memory</a>`,
    "<form method=\"post\" action=\"/admin/actions/memory-sync\" style=\"margin:0\">",
    withThemeField(theme),
    "<input type=\"hidden\" name=\"view\" value=\"memories\">",
    `<input type="hidden" name="active" value="${escapeHtml(activeFilter)}">`,
    `<input type="hidden" name="q" value="${escapeHtml(searchQuery)}">`,
    `<input type="hidden" name="memoryTypeFilter" value="${escapeHtml(memoryTypeFilter)}">`,
    `<input type="hidden" name="domainFilter" value="${escapeHtml(domainFilter)}">`,
    `<input type="hidden" name="page" value="${escapeHtml(String(page))}">`,
    `<input type="hidden" name="sort" value="${escapeHtml(sortKey)}">`,
    `<input type="hidden" name="direction" value="${escapeHtml(sortDirection)}">`,
    "<button type=\"submit\" class=\"toolbar-button secondary\">Resync Memories</button>",
    "</form>",
    "</div>",
    "</div>",
    "<div class=\"toolbar-row filters\">",
    "<form method=\"get\" action=\"/admin/memories\" class=\"toolbar-group\">",
    `<input type="hidden" name="theme" value="${escapeHtml(theme)}">`,
    `<input type="hidden" name="sort" value="${escapeHtml(sortKey)}">`,
    `<input type="hidden" name="direction" value="${escapeHtml(sortDirection)}">`,
    `<div class="toolbar-field search"><input id="memorySearch" name="q" type="search" value="${escapeHtml(searchQuery)}" placeholder="Search memories..."></div>`,
    `<div class="toolbar-field select"><select id="memoryTypeFilter" name="memoryType"><option value="">All Types</option>${renderOptions(DURABLE_MEMORY_TYPES, memoryTypeFilter)}</select></div>`,
    `<div class="toolbar-field select"><select id="domainFilter" name="domain"><option value="">All Categories</option>${renderOptions(categoryOptions, domainFilter)}</select></div>`,
    `<label style="display:flex;align-items:center;gap:.45rem;margin:0 0 0 .2rem"><input type="checkbox" name="active" value="archived"${activeFilter === "archived" ? " checked" : ""} style="width:auto">Archived</label>`,
    "<input type=\"hidden\" name=\"page\" value=\"1\">",
    "<button type=\"submit\" class=\"toolbar-button secondary\">Filter</button>",
    "</form>",
    "</div>",
    "</section>",
    "<section class=\"lite-panel flush\">",
    "<div class=\"memory-table-wrap\">",
    "<table class=\"memory-table\">",
    `<thead><tr><th>${renderSortableHeader("Title", "title")}</th><th>Content</th><th>${renderSortableHeader("Type", "memoryType")}</th><th>${renderSortableHeader("Category", "domain")}</th><th class="updated-col">${renderSortableHeader("Updated", "updatedAt")}</th><th class="actions-col">Actions</th></tr></thead>`,
    `<tbody>${memoryRows || "<tr><td colspan=\"6\" class=\"empty-state\">No durable memories found yet.</td></tr>"}</tbody>`,
    "</table>",
    "</div>",
    "</section>",
    "<section class=\"lite-toolbar\" style=\"border-bottom:none\">",
    "<div class=\"toolbar-row pagination\">",
    "<div class=\"toolbar-group\">",
    previousPage
      ? `<a class="toolbar-button secondary" href="${escapeHtml(buildLiteAdminLocation({
        view: "memories",
        theme,
        extra: buildLiteMemoryExtras({
          active: activeFilter,
          q: searchQuery,
          memoryType: memoryTypeFilter,
          domain: domainFilter,
          page: previousPage,
          sort: sortKey,
          direction: sortDirection,
        }),
      }))}">Previous</a>`
      : "<span class=\"toolbar-button secondary is-disabled\" aria-disabled=\"true\">Previous</span>",
    `<span class="meta">Page ${escapeHtml(String(page))} of ${escapeHtml(String(totalPages))}</span>`,
    nextPage
      ? `<a class="toolbar-button secondary" href="${escapeHtml(buildLiteAdminLocation({
        view: "memories",
        theme,
        extra: buildLiteMemoryExtras({
          active: activeFilter,
          q: searchQuery,
          memoryType: memoryTypeFilter,
          domain: domainFilter,
          page: nextPage,
          sort: sortKey,
          direction: sortDirection,
        }),
      }))}">Next</a>`
      : "<span class=\"toolbar-button secondary is-disabled\" aria-disabled=\"true\">Next</span>",
    "</div>",
    "</section>",
  ].join("");
}

function renderLiteMemoryEditorPage({
  config,
  editingMemory = null,
  activeFilter = "active",
  page = 1,
  theme = "light",
  searchQuery = "",
  memoryTypeFilter = "",
  domainFilter = "",
  sortKey = "updatedAt",
  sortDirection = "desc",
  helpers,
}) {
  const {
    escapeHtml,
    renderOptions,
    buildLiteCategoryOptions,
    buildLiteAdminLocation,
    buildLiteMemoryExtras,
    withThemeField,
    DURABLE_MEMORY_TYPES,
  } = helpers;
  const aiName = String(config?.chat?.promptBlocks?.personaName || "").trim() || "your AI";
  const isArchivedMemory = Boolean(editingMemory && editingMemory.active === false);
  const categoryOptions = buildLiteCategoryOptions(editingMemory?.domain || "");
  const backLocation = buildLiteAdminLocation({
    view: "memories",
    theme,
    extra: buildLiteMemoryExtras({
      active: activeFilter,
      q: searchQuery,
      memoryType: memoryTypeFilter,
      domain: domainFilter,
      page,
      sort: sortKey,
      direction: sortDirection,
    }),
  });

  return [
    "<section class=\"lite-panel\">",
    `<div class="panel-header"><div><h2>${editingMemory ? "Edit Memory" : "Add a New Memory"}</h2><p>${editingMemory ? `Update a saved memory that ${escapeHtml(aiName)} can carry forward across conversations.` : `Create a saved memory that ${escapeHtml(aiName)} can carry forward across conversations.`}</p></div></div>`,
    "<form method=\"post\" action=\"/admin/actions/memory-save\">",
    withThemeField(theme),
    "<input type=\"hidden\" name=\"view\" value=\"memories\">",
    `<input type="hidden" name="page" value="${escapeHtml(String(page))}">`,
    `<input type="hidden" name="active" value="${escapeHtml(activeFilter)}">`,
    `<input type="hidden" name="q" value="${escapeHtml(searchQuery)}">`,
    `<input type="hidden" name="memoryTypeFilter" value="${escapeHtml(memoryTypeFilter)}">`,
    `<input type="hidden" name="domainFilter" value="${escapeHtml(domainFilter)}">`,
    `<input type="hidden" name="sort" value="${escapeHtml(sortKey)}">`,
    `<input type="hidden" name="direction" value="${escapeHtml(sortDirection)}">`,
    "<input type=\"hidden\" name=\"sensitivity\" value=\"low\">",
    `<input type="hidden" name="restoreOnSave" value="${isArchivedMemory ? "1" : ""}">`,
    editingMemory ? `<input type="hidden" name="memoryId" value="${escapeHtml(editingMemory.memoryId)}">` : "",
    "<label for=\"memoryTitle\">Title</label>",
    `<input id="memoryTitle" name="title" type="text" required value="${escapeHtml(editingMemory?.title || "")}" placeholder="A short summary for this memory">`,
    "<label for=\"memoryContent\">Content</label>",
    `<textarea id="memoryContent" name="content" required placeholder="What should ${escapeHtml(aiName)} remember?">${escapeHtml(editingMemory?.content || "")}</textarea>`,
    "<div class=\"grid\">",
    `<div><label for="memoryType" title="Anchor = stable truths, Canon = important ongoing knowledge, Resolved = things that matter mostly as past context.">Memory Type</label><select id="memoryType" name="memoryType">${renderOptions(DURABLE_MEMORY_TYPES, editingMemory?.memoryType || "canon")}</select><p class="meta">Anchor: stable truths. Canon: active ongoing knowledge. Resolved: things that matter mostly as past context.</p></div>`,
    `<div><label for="memoryDomain">Category</label><select id="memoryDomain" name="domain">${renderOptions(categoryOptions, editingMemory?.domain || "general")}</select></div>`,
    "<div></div>",
    "</div>",
    "<div class=\"toolbar\" style=\"margin-top:1rem\">",
    `<button type="submit">${isArchivedMemory ? "Restore Memory" : "Save Memory"}</button>`,
    `<a class="icon-button" style="width:auto;padding:0 .8rem" href="${escapeHtml(backLocation)}">Cancel</a>`,
    "</div>",
    "</form>",
    "</section>",
  ].join("");
}

module.exports = {
  renderLiteMemoriesPage,
  renderLiteMemoryEditorPage,
};
