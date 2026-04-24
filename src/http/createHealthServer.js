const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const http = require("http");
const path = require("node:path");
const { deleteMemoryEverywhere } = require("../memory/deleteMemories");
const { canSyncMemories, syncMemoriesToQdrant, syncMemoryToQdrant } = require("../memory/syncMemories");
const { deleteCollection, deletePoints } = require("../memory/qdrantClient");
const { applyRuntimeSettings, extractRuntimeSettings, normalizeRuntimeSettings } = require("../config/runtimeSettings");
const {
  planSettingsSave,
} = require("../llm/modelValidation");
const { SUPPORTED_MEMORY_DOMAINS } = require("../memory/domains");
const {
  SUPPORTED_MEMORY_TYPES,
  SUPPORTED_SENSITIVITY_LEVELS,
  SUPPORTED_AUTOMATION_TYPES,
  MAX_CONVERSATION_EXPORT_CONVERSATIONS,
  MAX_CONVERSATION_LOG_EXPORT_EVENTS,
  MAX_CONVERSATION_EVENT_CSV_ROWS,
  buildConversationEventsCsv,
  buildConversationLogFilename,
  buildConversationLogsIndexCsv,
  buildConversationLogsMetadata,
  createZipBuffer,
} = require("../storage");
const { registerDiscordCommands } = require("../bot/registerCommands");
const { renderLayout, renderEntryPage: renderSharedEntryPage } = require("./renderShared");
const {
  renderLiteMemoriesPage: renderLiteMemoriesPageTemplate,
  renderLiteMemoryEditorPage: renderLiteMemoryEditorPageTemplate,
} = require("./renderLiteMemories");
const { renderLiteSettingsPage: renderLiteSettingsPageTemplate } = require("./renderLiteSettings");
const { renderLiteProactivePage: renderLiteProactivePageTemplate } = require("./renderLiteProactive");

const DURABLE_MEMORY_TYPES = Object.freeze(["anchor", "canon", "resolved"]);
const LITE_ADMIN_VIEWS = Object.freeze(["settings", "memories", "proactive"]);
const MEMORY_DELETE_CONFIRMATION_MESSAGE = "Are you sure you want to delete this memory?\n\nThis action can't be undone. If you only want to remove it from the active memory pool for now, archive it instead.";
const LITE_MEMORY_CATEGORIES = Object.freeze(
  SUPPORTED_MEMORY_DOMAINS.filter((value) => !["recent_events", "timeline"].includes(value)),
);
const ASSET_CONTENT_TYPES = Object.freeze({
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
});

function normalizeTheme(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "dark" ? "dark" : "light";
}

function normalizeLiteAdminView(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return LITE_ADMIN_VIEWS.includes(normalized) ? normalized : "settings";
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getAssetPath(filename) {
  return path.join(process.cwd(), "assets", filename);
}

function getLiteAssetUrl(kind, theme = "light") {
  const normalizedTheme = normalizeTheme(theme);
  const filename = {
    logo: normalizedTheme === "dark" ? "cadence_logo_dark.svg" : "cadence_logo_light.svg",
    dashboard: normalizedTheme === "dark" ? "cadence_dashboard_dark_icon.svg" : "cadence_dashboard_light_icon.svg",
    memories: normalizedTheme === "dark" ? "cadence_memories_dark_icon.svg" : "cadence_memories_light_icon.svg",
    automation: normalizedTheme === "dark" ? "cadence_automation_dark_icon.svg" : "cadence_automation_light_icon.svg",
    edit: normalizedTheme === "dark" ? "cadence_edit_dark_icon.svg" : "cadence_edit_light_icon.svg",
    pause: normalizedTheme === "dark" ? "cadence_pause_dark_icon.svg" : "cadence_pause_light_icon.svg",
    play: normalizedTheme === "dark" ? "cadence_play_dark_icon.svg" : "cadence_play_light_icon.svg",
    archive: normalizedTheme === "dark" ? "cadence_archive_dark_icon.svg" : "cadence_archive_light_icon.svg",
    restore: normalizedTheme === "dark" ? "cadence_restore_dark_icon.svg" : "cadence_restore_light_icon.svg",
    delete: normalizedTheme === "dark" ? "cadence_delete_dark_icon.svg" : "cadence_delete_light_icon.svg",
  }[kind];

  return filename ? `/assets/${filename}` : "";
}

function renderIconImage(kind, theme, alt = "", className = "icon-image") {
  const src = getLiteAssetUrl(kind, theme);
  if (!src) {
    return "";
  }

  return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" class="${escapeHtml(className)}">`;
}

function renderConfirmOnSubmit(message) {
  return ` onsubmit="return confirm(${escapeHtml(JSON.stringify(String(message || "")))})"`;
}

function renderEntryPage(options) {
  return renderSharedEntryPage({
    ...options,
    renderIconImage,
  });
}

function buildMemoryExportPayload({ memories = [] }) {
  return {
    exportedAt: new Date().toISOString(),
    product: "cadence-lite",
    memoryCount: memories.length,
    memories: memories.map((memory) => ({
      memoryId: memory.memoryId,
      title: memory.title,
      content: memory.content,
      memoryType: memory.memoryType,
      domain: memory.domain,
      sensitivity: memory.sensitivity,
      source: memory.source,
      active: Boolean(memory.active),
      referenceDate: memory.referenceDate || null,
      createdAt: memory.createdAt || null,
      updatedAt: memory.updatedAt || null,
    })),
  };
}

function buildAppSettingsExportPayload({
  settings = {},
  automations = [],
  journalEntries = [],
}) {
  return {
    exportedAt: new Date().toISOString(),
    product: "cadence-lite",
    exportType: "app_settings",
    includes: [
      "app_settings",
      "automations",
      "journal_entries",
    ],
    counts: {
      settings: Object.keys(settings || {}).length,
      automations: automations.length,
      journalEntries: journalEntries.length,
    },
    settings,
    automations: automations.map((automation) => ({
      automationId: automation.automationId,
      userScope: automation.userScope,
      type: automation.type,
      label: automation.label,
      channelId: automation.channelId,
      scheduleTime: automation.scheduleTime,
      timezone: automation.timezone,
      prompt: automation.prompt,
      enabled: Boolean(automation.enabled),
      mentionUser: Boolean(automation.mentionUser),
      userId: automation.userId || null,
      lastRunAt: automation.lastRunAt || null,
      lastError: automation.lastError || "",
      createdAt: automation.createdAt || null,
      updatedAt: automation.updatedAt || null,
    })),
    journalEntries: journalEntries.map((entry) => ({
      entryId: entry.entryId,
      userScope: entry.userScope,
      automationId: entry.automationId || null,
      channelId: entry.channelId || null,
      guildId: entry.guildId || null,
      title: entry.title,
      content: entry.content,
      createdAt: entry.createdAt || null,
    })),
  };
}

function buildMemoryImportRecords({ fields, files }) {
  const uploadedFile = files.file || files.memoriesFile;

  if (!uploadedFile?.content?.trim()) {
    throw new Error("Upload a Cadence memory export JSON file.");
  }

  let parsed;

  try {
    parsed = JSON.parse(uploadedFile.content);
  } catch (_error) {
    throw new Error("Memory import file must be valid JSON.");
  }

  const rawMemories = Array.isArray(parsed)
    ? parsed
    : (Array.isArray(parsed?.memories) ? parsed.memories : []);

  if (!rawMemories.length) {
    throw new Error("No memories were found in that import file.");
  }

  return rawMemories.map((memory) => ({
    memory_id: String(memory.memoryId || memory.memory_id || memory.id || "").trim() || undefined,
    title: String(memory.title || "").trim(),
    content: String(memory.content || memory.text || "").trim(),
    memory_type: String(memory.memoryType || memory.memory_type || "canon").trim().toLowerCase(),
    domain: String(memory.domain || "general").trim(),
    sensitivity: String(memory.sensitivity || "low").trim().toLowerCase(),
    source: String(memory.source || fields.importSource || "memory_import").trim() || "memory_import",
    active: memory.active !== false,
    reference_date: memory.referenceDate || memory.reference_date || "",
    created_at: memory.createdAt || memory.created_at || "",
    updated_at: memory.updatedAt || memory.updated_at || "",
  }));
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function parseBasicAuthHeader(header) {
  if (!header?.startsWith("Basic ")) {
    return null;
  }

  const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  const separatorIndex = decoded.indexOf(":");

  if (separatorIndex === -1) {
    return null;
  }

  return {
    username: decoded.slice(0, separatorIndex),
    password: decoded.slice(separatorIndex + 1),
  };
}

function isAuthorized(req, secret) {
  if (!secret) {
    return false;
  }

  const auth = parseBasicAuthHeader(req.headers.authorization);

  if (!auth) {
    return false;
  }

  const provided = Buffer.from(auth.password);
  const expected = Buffer.from(secret);

  if (provided.length !== expected.length) {
    return false;
  }

  return crypto.timingSafeEqual(provided, expected);
}

function sendAuthRequired(res) {
  res.writeHead(401, {
    "Content-Type": "text/plain; charset=utf-8",
    "WWW-Authenticate": 'Basic realm="Cadence Admin"',
  });
  res.end("Authentication required.");
}

function redirect(res, location) {
  res.writeHead(303, { Location: location });
  res.end();
}

function parseUrlEncoded(body) {
  const params = new URLSearchParams(body.toString("utf8"));
  return Object.fromEntries(params.entries());
}

function parseMultipartFormData(body, contentType) {
  const boundaryMatch = contentType.match(/boundary=([^;]+)/i);

  if (!boundaryMatch) {
    throw new Error("Missing multipart boundary.");
  }

  const boundary = `--${boundaryMatch[1]}`;
  const parts = body.toString("utf8").split(boundary).slice(1, -1);
  const fields = {};
  const files = {};

  for (const rawPart of parts) {
    const part = rawPart.replace(/^\r?\n/, "").replace(/\r?\n$/, "");
    const separatorIndex = part.indexOf("\r\n\r\n");

    if (separatorIndex === -1) {
      continue;
    }

    const headerText = part.slice(0, separatorIndex);
    const valueText = part.slice(separatorIndex + 4).replace(/\r\n$/, "");
    const headers = headerText.split("\r\n");
    const disposition = headers.find((line) => line.toLowerCase().startsWith("content-disposition:"));

    if (!disposition) {
      continue;
    }

    const nameMatch = disposition.match(/name="([^"]+)"/i);
    const fileMatch = disposition.match(/filename="([^"]*)"/i);

    if (!nameMatch) {
      continue;
    }

    const fieldName = nameMatch[1];

    if (fileMatch && fileMatch[1]) {
      const fileEntry = {
        filename: fileMatch[1],
        content: valueText,
      };

      if (!files[fieldName]) {
        files[fieldName] = fileEntry;
        continue;
      }

      if (Array.isArray(files[fieldName])) {
        files[fieldName].push(fileEntry);
        continue;
      }

      files[fieldName] = [files[fieldName], fileEntry];
      continue;
    }

    fields[fieldName] = valueText;
  }

  return {
    fields,
    files,
  };
}

async function parseRequestForm(req) {
  const body = await readRequestBody(req);
  const contentType = req.headers["content-type"] || "";

  if (contentType.includes("multipart/form-data")) {
    return parseMultipartFormData(body, contentType);
  }

  return {
    fields: parseUrlEncoded(body),
    files: {},
  };
}

function renderOptions(options, selectedValue) {
  return options.map((option) => {
    const selected = option === selectedValue ? " selected" : "";
    return `<option value="${escapeHtml(option)}"${selected}>${escapeHtml(option)}</option>`;
  }).join("");
}

function getAutomationTypeLabel(type) {
  if (type === "nudge" || type === "check_in") {
    return "check-in";
  }

  return String(type || "");
}

function renderAutomationTypeOptions(selectedValue) {
  return SUPPORTED_AUTOMATION_TYPES.map((option) => {
    const selected = option === selectedValue ? " selected" : "";
    return `<option value="${escapeHtml(option)}"${selected}>${escapeHtml(getAutomationTypeLabel(option))}</option>`;
  }).join("");
}

function buildLiteCategoryOptions(selectedValue = "") {
  const options = new Set(LITE_MEMORY_CATEGORIES);

  if (selectedValue && !options.has(selectedValue)) {
    options.add(selectedValue);
  }

  return Array.from(options);
}

function withThemeField(theme) {
  return `<input type="hidden" name="theme" value="${escapeHtml(theme)}">`;
}

function buildThemeLinks(url) {
  const lightParams = new URLSearchParams(url.searchParams);
  lightParams.set("theme", "light");
  const darkParams = new URLSearchParams(url.searchParams);
  darkParams.set("theme", "dark");

  return {
    light: `${url.pathname}?${lightParams.toString()}`,
    dark: `${url.pathname}?${darkParams.toString()}`,
  };
}

function buildAdminLocation({ path = "/admin", message = "", error = "", theme = "light", extra = {} } = {}) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(extra)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }

  if (theme) {
    params.set("theme", normalizeTheme(theme));
  }

  if (message) {
    params.set("message", message);
  }

  if (error) {
    params.set("error", error);
  }

  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

function buildLiteAdminPath(view = "settings") {
  const normalized = normalizeLiteAdminView(view);

  if (normalized === "settings") {
    return "/admin";
  }

  return `/admin/${normalized}`;
}

function buildLiteAdminLocation({
  view = "settings",
  message = "",
  error = "",
  theme = "light",
  extra = {},
} = {}) {
  return buildAdminLocation({
    path: buildLiteAdminPath(view),
    message,
    error,
    theme,
    extra,
  });
}

function formatDateValue(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toISOString().slice(0, 10);
}

function formatBytes(value) {
  const bytes = Number(value || 0);

  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let unitIndex = 0;
  let size = bytes;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  const decimals = size >= 10 || unitIndex === 0 ? 0 : 1;
  return `${size.toFixed(decimals)} ${units[unitIndex]}`;
}

function renderLiteSidebar({ currentView = "settings", theme = "light", themeLinks = null }) {
  const links = [
    {
      view: "settings",
      label: "Dashboard",
      icon: "dashboard",
    },
    {
      view: "memories",
      label: "Memories",
      icon: "memories",
    },
    {
      view: "proactive",
      label: "Automations",
      icon: "automation",
    },
  ];
  const navigationMarkup = [
    "<nav class=\"sidebar-nav\" aria-label=\"Lite admin navigation\">",
    ...links.map((link) => [
      `<a href="${escapeHtml(buildLiteAdminLocation({ view: link.view, theme }))}"${currentView === link.view ? " aria-current=\"page\"" : ""}>`,
      `<span class="sidebar-mark" aria-hidden="true">${renderIconImage(link.icon, theme, "", "sidebar-mark-image")}</span>`,
      `<span><strong style="display:block;font-size:.96rem;color:inherit;font-family:Inter,system-ui,sans-serif;font-weight:500">${escapeHtml(link.label)}</strong></span>`,
      "</a>",
    ].join("")),
    "</nav>",
  ].join("");
  const themeMarkup = themeLinks
    ? [
      "<div class=\"sidebar-footer\">",
      "<div class=\"theme-switcher\" aria-label=\"Theme toggle\">",
      `<a href="${escapeHtml(themeLinks.light)}"${theme === "light" ? " aria-current=\"page\"" : ""}>Light</a>`,
      `<a href="${escapeHtml(themeLinks.dark)}"${theme === "dark" ? " aria-current=\"page\"" : ""}>Dark</a>`,
      "</div>",
      "</div>",
    ].join("")
    : "";

  return [
    "<aside class=\"admin-sidebar\">",
    "<div class=\"sidebar-desktop\">",
    "<div class=\"sidebar-head\">",
    "<a class=\"sidebar-brand\" href=\"https://www.patreon.com/c/CadenceAI\" target=\"_blank\" rel=\"noreferrer\">",
    `<span class="sidebar-logo" aria-hidden="true">${renderIconImage("logo", theme, "", "sidebar-logo-image")}</span>`,
    "<span><strong>Cadence Lite</strong></span>",
    "</a>",
    "</div>",
    navigationMarkup,
    themeMarkup,
    "</div>",
    "<details class=\"sidebar-mobile\">",
    "<summary class=\"sidebar-mobile-toggle\">",
    "<span class=\"sidebar-mobile-brand\">",
    `<span class="sidebar-logo" aria-hidden="true">${renderIconImage("logo", theme, "", "sidebar-logo-image")}</span>`,
    "<span><strong>Cadence Lite</strong></span>",
    "</span>",
    "<span class=\"sidebar-mobile-trigger\">Menu</span>",
    "</summary>",
    "<div class=\"sidebar-mobile-panel\">",
    navigationMarkup,
    themeMarkup,
    "</div>",
    "</details>",
    "</aside>",
  ].join("");
}

function renderLiteSettingsPage(options) {
  return renderLiteSettingsPageTemplate({
    ...options,
    helpers: {
      extractRuntimeSettings,
      renderOptions,
      buildAdminLocation,
      formatDateValue,
      formatBytes,
      renderConfirmOnSubmit,
      withThemeField,
      escapeHtml,
    },
  });
}

function renderLiteMemoriesPage(options) {
  return renderLiteMemoriesPageTemplate({
    ...options,
    helpers: {
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
    },
  });
}

function renderLiteMemoryEditorPage(options) {
  return renderLiteMemoryEditorPageTemplate({
    ...options,
    helpers: {
      escapeHtml,
      renderOptions,
      buildLiteCategoryOptions,
      buildLiteAdminLocation,
      buildLiteMemoryExtras,
      withThemeField,
      DURABLE_MEMORY_TYPES,
    },
  });
}

function renderDurableMemoryManagerSection({
  config,
  memories = [],
  editingMemory = null,
  activeFilter = "active",
  page = 1,
  pageSize = 10,
  totalMemories = 0,
  theme = "light",
}) {
  const syncAvailable = canSyncMemories(config);
  const totalPages = Math.max(1, Math.ceil(totalMemories / pageSize));
  const previousPage = page > 1 ? page - 1 : null;
  const nextPage = page < totalPages ? page + 1 : null;
  const memoryRows = memories.map((memory) => [
    "<tr>",
    "<td><p class=\"memory-title\">",
    escapeHtml(memory.title),
    "</p></td>",
    `<td><div class="memory-content">${escapeHtml(memory.content)}</div></td>`,
    `<td><span class="badge type">${escapeHtml(memory.memoryType)}</span></td>`,
    `<td><span class="badge domain">${escapeHtml(memory.domain)}</span></td>`,
    `<td><span class="badge sensitivity">${escapeHtml(memory.sensitivity)}</span></td>`,
    `<td>${escapeHtml(formatDateValue(memory.updatedAt))}</td>`,
    "<td><div class=\"row-actions\">",
    `<a class="icon-button" href="${escapeHtml(buildAdminLocation({ theme, extra: { edit: memory.memoryId, active: activeFilter, page } }))}" aria-label="Edit memory" title="Edit memory">✎</a>`,
    "<form method=\"post\" action=\"/admin/actions/memory-archive\">",
    withThemeField(theme),
    `<input type="hidden" name="page" value="${escapeHtml(String(page))}">`,
    `<input type="hidden" name="memoryId" value="${escapeHtml(memory.memoryId)}">`,
    "<button type=\"submit\" class=\"icon-button\" aria-label=\"Archive memory\" title=\"Archive memory\">↥</button>",
    "</form>",
    `<form method="post" action="/admin/actions/memory-delete"${renderConfirmOnSubmit(MEMORY_DELETE_CONFIRMATION_MESSAGE)}>`,
    withThemeField(theme),
    `<input type="hidden" name="page" value="${escapeHtml(String(page))}">`,
    `<input type="hidden" name="memoryId" value="${escapeHtml(memory.memoryId)}">`,
    "<button type=\"submit\" class=\"icon-button\" aria-label=\"Delete memory\" title=\"Delete memory\">⌫</button>",
    "</form>",
    "</div></td>",
    "</tr>",
  ].join("")).join("");

  return [
    "<section class=\"card\">",
    "<div class=\"panel-header\"><div><h2>Durable Memories</h2><p>Core keeps the same durable editing desk close at hand, even while the temporal machinery gets messier.</p></div></div>",
    "<form method=\"post\" action=\"/admin/actions/memory-save\">",
    withThemeField(theme),
    `<input type="hidden" name="page" value="${escapeHtml(String(page))}">`,
    editingMemory ? `<input type="hidden" name="memoryId" value="${escapeHtml(editingMemory.memoryId)}">` : "",
    "<label for=\"memoryTitle\">Title</label>",
    `<input id="memoryTitle" name="title" type="text" required value="${escapeHtml(editingMemory?.title || "")}" placeholder="Routines around winding down">`,
    "<label for=\"memoryContent\">Content</label>",
    `<textarea id="memoryContent" name="content" required placeholder="What should Cadence remember?">${escapeHtml(editingMemory?.content || "")}</textarea>`,
    "<div class=\"grid\">",
    `<div><label for="memoryType">Memory Type</label><select id="memoryType" name="memoryType">${renderOptions(DURABLE_MEMORY_TYPES, editingMemory?.memoryType || "canon")}</select></div>`,
    `<div><label for="memoryDomain">Domain</label><select id="memoryDomain" name="domain">${renderOptions(SUPPORTED_MEMORY_DOMAINS, editingMemory?.domain || "general")}</select></div>`,
    `<div><label for="memorySensitivity">Sensitivity</label><select id="memorySensitivity" name="sensitivity">${renderOptions(SUPPORTED_SENSITIVITY_LEVELS, editingMemory?.sensitivity || "low")}</select></div>`,
    "</div>",
    "<div class=\"toolbar\"><button type=\"submit\">Save Memory</button></div>",
    "</form>",
    `<p class="meta" style="margin-top:1rem">${escapeHtml(String(totalMemories))} total durable memories. Page ${escapeHtml(String(page))} of ${escapeHtml(String(totalPages))}.</p>`,
    "<form method=\"get\" action=\"/admin\" class=\"toolbar\" style=\"margin:.85rem 0\">",
    `<input type="hidden" name="theme" value="${escapeHtml(theme)}">`,
    "<label for=\"coreActiveFilter\" style=\"margin:0\">Show</label>",
    `<select id="coreActiveFilter" name="active"><option value="active"${activeFilter === "active" ? " selected" : ""}>Active only</option><option value="all"${activeFilter === "all" ? " selected" : ""}>All memories</option></select>`,
    "<input type=\"hidden\" name=\"page\" value=\"1\">",
    "<button type=\"submit\" class=\"secondary\">Apply</button>",
    "</form>",
    "<div class=\"memory-table-wrap\">",
    "<table class=\"memory-table\">",
    "<thead><tr><th>Title</th><th>Content</th><th>Memory Type</th><th>Domain</th><th>Sensitivity</th><th>Last Updated</th><th>Actions</th></tr></thead>",
    `<tbody>${memoryRows || "<tr><td colspan=\"7\" class=\"empty-state\">No durable memories found yet.</td></tr>"}</tbody>`,
    "</table>",
    "</div>",
    "<div class=\"toolbar\" style=\"margin-top:.85rem;justify-content:space-between\">",
    "<div class=\"toolbar\">",
    previousPage
      ? `<a class="icon-button" style="width:auto;padding:0 .8rem" href="${escapeHtml(buildAdminLocation({ theme, extra: { active: activeFilter, page: previousPage } }))}">Previous</a>`
      : "<span class=\"badge\">Previous</span>",
    nextPage
      ? `<a class="icon-button" style="width:auto;padding:0 .8rem" href="${escapeHtml(buildAdminLocation({ theme, extra: { active: activeFilter, page: nextPage } }))}">Next</a>`
      : "<span class=\"badge\">Next</span>",
    "</div>",
    "<form method=\"post\" action=\"/admin/actions/memory-sync\">",
    withThemeField(theme),
    `<input type="hidden" name="active" value="${escapeHtml(activeFilter)}">`,
    `<input type="hidden" name="page" value="${escapeHtml(String(page))}">`,
    `<button type="submit" class="secondary"${syncAvailable ? "" : " disabled"}>Resync Durable Memories</button>`,
    "</form>",
    "</div>",
    "</section>",
  ].join("");
}

function renderLiteProactivePage(options) {
  return renderLiteProactivePageTemplate({
    ...options,
    helpers: {
      escapeHtml,
      formatDateValue,
      getAutomationTypeLabel,
      renderAutomationTypeOptions,
      buildLiteAdminLocation,
      buildLiteAutomationExtras,
      renderIconImage,
      renderConfirmOnSubmit,
      withThemeField,
    },
  });
}

function renderLiteAdminPage({
  config,
  memories = [],
  automations = [],
  journalEntries = [],
  conversationStorage = null,
  editingAutomation = null,
  editingMemory = null,
  activeFilter = "active",
  page = 1,
  pageSize = 20,
  totalMemories = 0,
  searchQuery = "",
  memoryTypeFilter = "",
  domainFilter = "",
  sortKey = "updatedAt",
  sortDirection = "desc",
  message = "",
  error = "",
  theme = "light",
  themeLinks = null,
  currentView = "settings",
  journalPage = 1,
  journalTotalPages = 1,
}) {
  const normalizedView = normalizeLiteAdminView(currentView);
  let pageBody = "";

  if (normalizedView === "memories") {
    pageBody = renderLiteMemoriesPage({
      config,
      memories,
      editingMemory,
      activeFilter,
      page,
      pageSize,
      totalMemories,
      theme,
      searchQuery,
      memoryTypeFilter,
      domainFilter,
      sortKey,
      sortDirection,
    });
  } else if (normalizedView === "proactive") {
    pageBody = renderLiteProactivePage({
      automations,
      journalEntries,
      editingAutomation,
      journalPage,
      journalTotalPages,
      theme,
    });
  } else {
    pageBody = renderLiteSettingsPage({
      config,
      page,
      theme,
      conversationStorage,
    });
  }

  const body = [
    "<div class=\"admin-shell lite-shell\">",
    renderLiteSidebar({
      currentView: normalizedView,
      theme,
      themeLinks,
    }),
    `<section class="admin-main lite-main">${pageBody}</section>`,
    "</div>",
  ].join("");

  return renderLayout({
    title: "Cadence Lite Admin",
    body,
    message,
    error,
    theme,
    themeLinks,
    hideTitle: true,
    hideTopbar: true,
  });
}

function getMessage(url) {
  return url.searchParams.get("message") || "";
}

function getError(url) {
  return url.searchParams.get("error") || "";
}

function parseLiteMemoryForm(fields) {
  return {
    memoryId: String(fields.memoryId || "").trim(),
    title: String(fields.title || "").trim(),
    content: String(fields.content || "").trim(),
    memoryType: String(fields.memoryType || "").trim().toLowerCase(),
    domain: String(fields.domain || "").trim(),
    sensitivity: String(fields.sensitivity || "").trim().toLowerCase(),
  };
}

function parseLiteSettingsForm(fields) {
  return normalizeRuntimeSettings({
    "llm.chat.model": fields.chatModel,
    "llm.image.model": fields.imageModel,
    "llm.embedding.model": fields.embeddingModel,
    "llm.transcription.model": fields.transcriptionModel,
    "chat.historyLimit": fields.historyLimit,
    "chat.timezone": fields.chatTimezone,
    "chat.promptBlocks.personaName": fields.personaName,
    "chat.promptBlocks.userName": fields.userName,
    "chat.promptBlocks.personaProfile": fields.personaProfile,
    "chat.promptBlocks.toneGuidelines": fields.toneGuidelines,
    "chat.promptBlocks.userProfile": fields.userProfile,
    "chat.promptBlocks.companionPurpose": fields.companionPurpose,
    "chat.promptBlocks.boundaryRules": fields.boundaryRules,
  });
}

function getLiteViewFromPath(pathname) {
  if (pathname === "/admin/memories/new" || pathname === "/admin/memories/edit") {
    return "memory-editor";
  }

  if (pathname === "/admin/memories") {
    return "memories";
  }

  if (pathname === "/admin/proactive") {
    return "proactive";
  }

  return "settings";
}

function buildLiteMemoryQueryState(url) {
  return {
    active: url.searchParams.get("active") === "archived" ? "archived" : "active",
    q: String(url.searchParams.get("q") || "").trim(),
    memoryType: String(url.searchParams.get("memoryType") || "").trim().toLowerCase(),
    domain: String(url.searchParams.get("domain") || "").trim(),
    sort: String(url.searchParams.get("sort") || "updatedAt").trim(),
    direction: String(url.searchParams.get("direction") || "desc").trim().toLowerCase() === "asc" ? "asc" : "desc",
  };
}

function buildLiteMemoryExtras({
  active = "active",
  q = "",
  memoryType = "",
  domain = "",
  page = 1,
  edit = "",
  sort = "updatedAt",
  direction = "desc",
} = {}) {
  return {
    active,
    q,
    memoryType,
    domain,
    page,
    edit,
    sort,
    direction,
  };
}

function buildLiteAutomationExtras({
  automation = "",
  journalPage = "",
} = {}) {
  return {
    automation,
    journalPage,
  };
}

function parseLiteAutomationForm(fields) {
  const enabledState = String(fields.enabledState || "").trim().toLowerCase();

  return {
    automationId: String(fields.automationId || "").trim(),
    type: String(fields.type || "").trim().toLowerCase(),
    label: String(fields.label || "").trim(),
    channel_id: String(fields.channelId || "").trim(),
    schedule_time: String(fields.scheduleTime || "").trim(),
    prompt: String(fields.prompt || "").trim(),
    enabled: enabledState
      ? enabledState === "enabled"
      : (fields.enabled === "on" || fields.enabled === "true" || fields.enabled === "1"),
    mention_user: fields.mentionUser === "on" || fields.mentionUser === "true" || fields.mentionUser === "1",
    user_id: String(fields.userId || "").trim(),
  };
}

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

function withAdmin(handler) {
  return async (req, res, context) => {
    if (!context.config.admin.secret) {
      res.writeHead(503, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("ADMIN_SECRET is required to use the admin interface.");
      return;
    }

    if (!isAuthorized(req, context.config.admin.secret)) {
      sendAuthRequired(res);
      return;
    }

    if (!context.ready) {
      res.writeHead(503, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Cadence is still starting up. Try again in a moment.");
      return;
    }

    try {
      await handler(req, res, context);
    } catch (error) {
      context.logger.error("[admin] Request failed", {
        message: error.message,
      });

      const requestUrl = new URL(req.url, "http://localhost");
      const target = requestUrl.pathname.startsWith("/admin/staged/")
        ? requestUrl.pathname
        : "/admin";
      redirect(res, `${target}?error=${encodeURIComponent(error.message)}`);
    }
  };
}

function createHealthServer({
  port,
  logger,
  appContext,
}) {
  const context = appContext;

  const server = http.createServer((req, res) => {
    Promise.resolve().then(async () => {
      const url = new URL(req.url, "http://localhost");

      if (req.method === "GET" && url.pathname === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          ok: true,
          ready: Boolean(context.ready),
          service: "cadence-lite",
          transport: "discord",
        }));
        return;
      }

      if (req.method === "GET" && url.pathname === "/") {
        const theme = normalizeTheme(url.searchParams.get("theme"));
        if (context.config.admin.secret && isAuthorized(req, context.config.admin.secret)) {
          redirect(res, buildLiteAdminLocation({ theme }));
          return;
        }

        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(renderEntryPage({
          config: context.config,
          ready: Boolean(context.ready),
          theme,
        }));
        return;
      }

      if (req.method === "GET" && url.pathname === "/admin/exports/memories") {
        return withAdmin(async (_req, innerRes, innerContext) => {
          const allMemories = await innerContext.memoryStore.listMemories({
            userScope: innerContext.config.memory.userScope,
            limit: 5000,
            activeOnly: false,
          });
          const durableMemories = allMemories
            .filter((memory) => DURABLE_MEMORY_TYPES.includes(memory.memoryType))
            .sort((left, right) => {
              const leftTime = Date.parse(left.updatedAt || "") || 0;
              const rightTime = Date.parse(right.updatedAt || "") || 0;
              return rightTime - leftTime;
            });
          const payload = buildMemoryExportPayload({
            config: innerContext.config,
            memories: durableMemories,
          });
          const dateStamp = new Date().toISOString().slice(0, 10);

          innerRes.writeHead(200, {
            "Content-Type": "application/json; charset=utf-8",
            "Content-Disposition": `attachment; filename="cadence-memories-${dateStamp}.json"`,
            "Cache-Control": "no-store",
          });
          innerRes.end(JSON.stringify(payload, null, 2));
        })(req, res, context);
      }

      if (req.method === "GET" && url.pathname === "/admin/exports/app-settings") {
        return withAdmin(async (_req, innerRes, innerContext) => {
          const [settings, automations, journalEntries] = await Promise.all([
            innerContext.settingsStore.listSettings(),
            innerContext.automationStore.listAutomations({
              userScope: innerContext.config.memory.userScope,
            }),
            innerContext.journalStore.listEntries({
              userScope: innerContext.config.memory.userScope,
              limit: 5000,
            }),
          ]);
          const payload = buildAppSettingsExportPayload({
            config: innerContext.config,
            settings,
            automations,
            journalEntries,
          });
          const dateStamp = new Date().toISOString().slice(0, 10);

          innerRes.writeHead(200, {
            "Content-Type": "application/json; charset=utf-8",
            "Content-Disposition": `attachment; filename="cadence-app-settings-${dateStamp}.json"`,
            "Cache-Control": "no-store",
          });
          innerRes.end(JSON.stringify(payload, null, 2));
        })(req, res, context);
      }

      if (req.method === "GET" && url.pathname === "/admin/exports/conversation-events.csv") {
        return withAdmin(async (_req, innerRes, innerContext) => {
          const guildId = innerContext.config.discord.guildId || "";
          const rows = await innerContext.conversations.listEventsForExport({
            guildId,
            limit: MAX_CONVERSATION_EVENT_CSV_ROWS,
          });
          const payload = buildConversationEventsCsv(rows);
          const dateStamp = new Date().toISOString().slice(0, 10);

          innerRes.writeHead(200, {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="cadence-conversation-events-${dateStamp}.csv"`,
            "Cache-Control": "no-store",
          });
          innerRes.end(payload);
        })(req, res, context);
      }

      if (req.method === "GET" && url.pathname === "/admin/exports/conversation-logs") {
        return withAdmin(async (_req, innerRes, innerContext) => {
          const guildId = innerContext.config.discord.guildId || "";
          const conversations = await innerContext.conversations.listConversations({
            guildId,
            limit: MAX_CONVERSATION_EXPORT_CONVERSATIONS,
          });
          const usedLogNames = new Set();
          const generatedAt = new Date().toISOString();
          const files = [];
          const indexEntries = [];

          for (const conversation of conversations) {
            const events = await innerContext.conversations.listEventsByConversationId({
              conversationId: conversation.conversationId,
              guildId,
              limit: MAX_CONVERSATION_LOG_EXPORT_EVENTS,
            });
            const filename = buildConversationLogFilename(conversation, usedLogNames);
            const content = innerContext.conversations.formatConversationExport(events, {
              conversation,
            });

            files.push({
              name: `logs/${filename}`,
              content: `${content}\n`,
              modifiedAt: conversation.lastEventAt || generatedAt,
            });
            indexEntries.push({
              ...conversation,
              filename,
              eventCount: events.length,
            });
          }

          files.push({
            name: "index.csv",
            content: buildConversationLogsIndexCsv(indexEntries),
            modifiedAt: generatedAt,
          });
          files.push({
            name: "metadata.json",
            content: JSON.stringify(buildConversationLogsMetadata({
              entries: indexEntries,
              generatedAt,
              conversationLimit: MAX_CONVERSATION_EXPORT_CONVERSATIONS,
              perConversationEventLimit: MAX_CONVERSATION_LOG_EXPORT_EVENTS,
            }), null, 2),
            modifiedAt: generatedAt,
          });

          const payload = createZipBuffer(files, { now: generatedAt });
          const dateStamp = generatedAt.slice(0, 10);

          innerRes.writeHead(200, {
            "Content-Type": "application/zip",
            "Content-Disposition": `attachment; filename="cadence-conversation-logs-${dateStamp}.zip"`,
            "Cache-Control": "no-store",
          });
          innerRes.end(payload);
        })(req, res, context);
      }

      if (req.method === "GET" && url.pathname.startsWith("/assets/")) {
        const assetName = path.basename(url.pathname);
        const assetPath = getAssetPath(assetName);

        try {
          const content = await fs.readFile(assetPath);
          const contentType = ASSET_CONTENT_TYPES[path.extname(assetName).toLowerCase()] || "application/octet-stream";
          res.writeHead(200, {
            "Content-Type": contentType,
            "Cache-Control": "no-store",
          });
          res.end(content);
        } catch (_error) {
          res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("Asset not found.");
        }
        return;
      }

      if (req.method === "GET" && (url.pathname === "/admin" || url.pathname === "/admin/memories" || url.pathname === "/admin/proactive" || url.pathname === "/admin/memories/new" || url.pathname === "/admin/memories/edit")) {
        return withAdmin(async (_req, innerRes, innerContext) => {
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
          const allMemories = await innerContext.memoryStore.listMemories({
            userScope: innerContext.config.memory.userScope,
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
            ? await innerContext.memoryStore.getMemoryById(editId, {
              userScope: innerContext.config.memory.userScope,
            })
            : null;
          const editingMemory = editCandidate && DURABLE_MEMORY_TYPES.includes(editCandidate.memoryType)
            ? editCandidate
            : null;
          const automations = currentView === "proactive"
            ? await innerContext.automationStore.listAutomations({
              userScope: innerContext.config.memory.userScope,
            })
            : [];
          let conversationStorage = null;

          if (currentView === "settings") {
            try {
              conversationStorage = await innerContext.conversations.getStorageStats({
                guildId: innerContext.config.discord.guildId || "",
              });
            } catch (error) {
              innerContext.logger.warn("[admin] Failed to load conversation storage stats", {
                error: error?.message || String(error),
              });
            }
          }
          const totalJournalEntries = currentView === "proactive"
            ? await innerContext.journalStore.countEntries({
              userScope: innerContext.config.memory.userScope,
            })
            : 0;
          const journalEntries = currentView === "proactive"
            ? await innerContext.journalStore.listRecentEntries({
              userScope: innerContext.config.memory.userScope,
              limit: journalPageSize,
              offset: (journalPage - 1) * journalPageSize,
            })
            : [];
          const editingAutomation = currentView === "proactive" && automationId
            ? await innerContext.automationStore.getAutomationById(automationId, {
              userScope: innerContext.config.memory.userScope,
            })
            : null;

          innerRes.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });

          if (currentView === "memory-editor") {
            innerRes.end(renderLayout({
              title: editingMemory ? "Edit Memory" : "Add Memory",
              body: [
                "<div class=\"admin-shell lite-shell\">",
                renderLiteSidebar({
                  currentView: "memories",
                  theme,
                  themeLinks,
                }),
                `<section class="admin-main lite-main">${renderLiteMemoryEditorPage({
                  config: innerContext.config,
                  editingMemory,
                  activeFilter,
                  page,
                  theme,
                  searchQuery: liteMemoryState.q,
                  memoryTypeFilter: liteMemoryState.memoryType,
                  domainFilter: liteMemoryState.domain,
                  sortKey: liteMemoryState.sort,
                  sortDirection: liteMemoryState.direction,
                })}</section>`,
                "</div>",
              ].join(""),
              message: getMessage(url),
              error: getError(url),
              theme,
              themeLinks,
              hideTitle: true,
              hideTopbar: true,
            }));
            return;
          }

          innerRes.end(renderLiteAdminPage({
            config: innerContext.config,
            memories,
            automations,
            journalEntries,
            editingAutomation,
            activeFilter,
            page,
            pageSize,
            totalMemories,
            searchQuery: liteMemoryState.q,
            memoryTypeFilter: liteMemoryState.memoryType,
            domainFilter: liteMemoryState.domain,
            sortKey: liteMemoryState.sort,
            sortDirection: liteMemoryState.direction,
            conversationStorage,
            message: getMessage(url),
            error: getError(url),
            theme,
            themeLinks,
            currentView,
            journalPage,
            journalTotalPages: Math.max(1, Math.ceil(totalJournalEntries / journalPageSize)),
          }));
        })(req, res, context);
      }

      if (req.method === "POST" && url.pathname === "/admin/actions/memory-save") {
        return withAdmin(async (innerReq, innerRes, innerContext) => {
          const { fields } = await parseRequestForm(innerReq);
          const theme = normalizeTheme(fields.theme);
          const view = normalizeLiteAdminView(fields.view);
          const submitted = parseLiteMemoryForm(fields);
          if (!DURABLE_MEMORY_TYPES.includes(submitted.memoryType)) {
            throw new Error(`Lite only supports durable memory types: ${DURABLE_MEMORY_TYPES.join(", ")}.`);
          }

          const existing = submitted.memoryId
            ? await innerContext.memoryStore.getMemoryById(submitted.memoryId, {
              userScope: innerContext.config.memory.userScope,
            })
            : null;

          const saved = await innerContext.memoryStore.upsertMemory({
            memory_id: existing?.memoryId || undefined,
            title: submitted.title,
            content: submitted.content,
            memory_type: submitted.memoryType,
            domain: submitted.domain,
            sensitivity: submitted.sensitivity,
            importance: submitted.importance || undefined,
            source: existing?.source || "admin_ui",
            active: fields.restoreOnSave === "1" ? true : (existing?.active ?? true),
            created_at: existing?.createdAt,
          }, {
            userScope: innerContext.config.memory.userScope,
          });

          let message = fields.restoreOnSave === "1"
            ? `Restored durable memory "${saved.title}".`
            : `Saved durable memory "${saved.title}".`;

          if (canSyncMemories(innerContext.config)) {
            const syncResult = await syncMemoryToQdrant({
              config: innerContext.config,
              memory: saved,
            });

            if (!syncResult.skipped) {
              message = fields.restoreOnSave === "1"
                ? `Restored durable memory "${saved.title}" and synced it to Qdrant.`
                : `Saved durable memory "${saved.title}" and synced it to Qdrant.`;
            }
          }

          redirect(innerRes, buildLiteAdminLocation({
            view,
            message,
            theme,
            extra: buildLiteMemoryExtras({
              active: fields.active === "archived" ? "archived" : "active",
              q: fields.q,
              memoryType: fields.memoryTypeFilter,
              domain: fields.domainFilter,
              page: fields.page || 1,
            }),
          }));
        })(req, res, context);
      }

      if (req.method === "POST" && url.pathname === "/admin/actions/memory-import") {
        return withAdmin(async (innerReq, innerRes, innerContext) => {
          const { fields, files } = await parseRequestForm(innerReq);
          const theme = normalizeTheme(fields.theme);
          const view = normalizeLiteAdminView(fields.view);
          const records = buildMemoryImportRecords({ fields, files })
            .filter((record) => DURABLE_MEMORY_TYPES.includes(record.memory_type));

          if (!records.length) {
            throw new Error(`Import only supports durable memory types: ${DURABLE_MEMORY_TYPES.join(", ")}.`);
          }

          const importedMemories = [];

          for (const record of records) {
            const saved = await innerContext.memoryStore.upsertMemory(record, {
              userScope: innerContext.config.memory.userScope,
            });
            importedMemories.push(saved);
          }

          let message = `Imported ${importedMemories.length} durable ${importedMemories.length === 1 ? "memory" : "memories"}.`;

          if (canSyncMemories(innerContext.config)) {
            const syncResult = await syncMemoriesToQdrant({
              config: innerContext.config,
              memories: importedMemories,
            });

            if (!syncResult.skipped && syncResult.syncedCount > 0) {
              message = `Imported ${importedMemories.length} durable ${importedMemories.length === 1 ? "memory" : "memories"} and synced ${syncResult.syncedCount} to Qdrant.`;
            }
          }

          redirect(innerRes, buildLiteAdminLocation({
            view,
            message,
            theme,
            extra: buildLiteMemoryExtras({
              active: fields.active === "archived" ? "archived" : "active",
              q: fields.q,
              memoryType: fields.memoryTypeFilter,
              domain: fields.domainFilter,
              page: fields.page || 1,
              sort: fields.sort || "updatedAt",
              direction: fields.direction || "desc",
            }),
          }));
        })(req, res, context);
      }

      if (req.method === "POST" && url.pathname === "/admin/actions/memory-archive") {
        return withAdmin(async (innerReq, innerRes, innerContext) => {
          const { fields } = await parseRequestForm(innerReq);
          const theme = normalizeTheme(fields.theme);
          const view = normalizeLiteAdminView(fields.view);
          const existing = await innerContext.memoryStore.getMemoryById(fields.memoryId, {
            userScope: innerContext.config.memory.userScope,
          });

          if (!existing) {
            redirect(innerRes, buildLiteAdminLocation({
              view,
              error: "Memory not found.",
              theme,
            }));
            return;
          }

          const nextActiveState = existing.active ? false : true;
          const updated = await innerContext.memoryStore.upsertMemory({
            memory_id: existing.memoryId,
            title: existing.title,
            content: existing.content,
            memory_type: existing.memoryType,
            domain: existing.domain,
            sensitivity: existing.sensitivity,
            importance: existing.importance,
            source: existing.source,
            active: nextActiveState,
            created_at: existing.createdAt,
          }, {
            userScope: innerContext.config.memory.userScope,
          });

          if (innerContext.config.qdrant?.url) {
            if (updated.active) {
              await syncMemoryToQdrant({
                config: innerContext.config,
                memory: updated,
              });
            } else {
              await deletePoints({
                config: innerContext.config,
                ids: [updated.memoryId],
              });
            }
          }

          redirect(innerRes, buildLiteAdminLocation({
            view,
            message: `${updated.active ? "Restored" : "Archived"} durable memory "${updated.title}".`,
            theme,
            extra: buildLiteMemoryExtras({
              active: fields.active === "archived" ? "archived" : "active",
              q: fields.q,
              memoryType: fields.memoryTypeFilter,
              domain: fields.domainFilter,
              page: fields.page || 1,
            }),
          }));
        })(req, res, context);
      }

      if (req.method === "POST" && url.pathname === "/admin/actions/memory-delete") {
        return withAdmin(async (innerReq, innerRes, innerContext) => {
          const { fields } = await parseRequestForm(innerReq);
          const theme = normalizeTheme(fields.theme);
          const view = normalizeLiteAdminView(fields.view);
          const result = await deleteMemoryEverywhere({
            config: innerContext.config,
            memoryStore: innerContext.memoryStore,
            memoryId: fields.memoryId,
            userScope: innerContext.config.memory.userScope,
          });

          redirect(innerRes, buildLiteAdminLocation({
            view,
            message: result.deleted
              ? `Deleted durable memory "${result.memory.title}".`
              : "Nothing was deleted.",
            theme,
            extra: buildLiteMemoryExtras({
              active: fields.active === "archived" ? "archived" : "active",
              q: fields.q,
              memoryType: fields.memoryTypeFilter,
              domain: fields.domainFilter,
              page: fields.page || 1,
            }),
          }));
        })(req, res, context);
      }

      if (req.method === "POST" && url.pathname === "/admin/actions/memory-sync") {
        return withAdmin(async (innerReq, innerRes, innerContext) => {
          const { fields } = await parseRequestForm(innerReq);
          const theme = normalizeTheme(fields.theme);
          const view = normalizeLiteAdminView(fields.view);

          if (!canSyncMemories(innerContext.config)) {
            redirect(innerRes, buildLiteAdminLocation({
              view,
              error: "Qdrant sync needs QDRANT_URL and a working embeddings provider API key.",
              theme,
              extra: buildLiteMemoryExtras({
                active: fields.active === "archived" ? "archived" : "active",
                q: fields.q,
                memoryType: fields.memoryTypeFilter,
                domain: fields.domainFilter,
                page: fields.page || 1,
              }),
            }));
            return;
          }

          const memories = (await innerContext.memoryStore.listMemories({
            userScope: innerContext.config.memory.userScope,
            limit: 500,
            activeOnly: true,
          })).filter((memory) => DURABLE_MEMORY_TYPES.includes(memory.memoryType));

          const result = await syncMemoriesToQdrant({
            config: innerContext.config,
            memories,
          });

          redirect(innerRes, buildLiteAdminLocation({
            view,
            message: `Synced ${result.syncedCount} active durable memories to Qdrant.`,
            theme,
            extra: buildLiteMemoryExtras({
              active: fields.active === "archived" ? "archived" : "active",
              q: fields.q,
              memoryType: fields.memoryTypeFilter,
              domain: fields.domainFilter,
              page: fields.page || 1,
            }),
          }));
        })(req, res, context);
      }

      if (req.method === "POST" && url.pathname === "/admin/actions/memory-rebuild") {
        return withAdmin(async (innerReq, innerRes, innerContext) => {
          const { fields } = await parseRequestForm(innerReq);
          const theme = normalizeTheme(fields.theme);
          const view = normalizeLiteAdminView(fields.view);

          if (!canSyncMemories(innerContext.config)) {
            redirect(innerRes, buildLiteAdminLocation({
              view,
              error: "Memory index rebuild needs QDRANT_URL and a working embeddings provider API key.",
              theme,
              extra: {
                active: "all",
                page: fields.page || 1,
              },
            }));
            return;
          }

          const memories = (await innerContext.memoryStore.listMemories({
            userScope: innerContext.config.memory.userScope,
            limit: 5000,
            activeOnly: true,
          })).filter((memory) => DURABLE_MEMORY_TYPES.includes(memory.memoryType));

          await deleteCollection({
            config: innerContext.config,
          });

          const result = await syncMemoriesToQdrant({
            config: innerContext.config,
            memories,
          });

          const message = result.syncedCount
            ? `Rebuilt the Qdrant memory index and resynced ${result.syncedCount} active durable memories.`
            : "Deleted the old Qdrant memory index. No active durable memories were available to resync.";

          redirect(innerRes, buildLiteAdminLocation({
            view,
            message,
            theme,
            extra: {
              active: "all",
              page: fields.page || 1,
            },
          }));
        })(req, res, context);
      }

      if (req.method === "POST" && url.pathname === "/admin/actions/settings-save") {
        return withAdmin(async (innerReq, innerRes, innerContext) => {
          const { fields } = await parseRequestForm(innerReq);
          const theme = normalizeTheme(fields.theme);
          const view = normalizeLiteAdminView(fields.view);
          const settings = parseLiteSettingsForm(fields);
          const savePlan = await planSettingsSave({
            config: innerContext.config,
            settings,
            fetchImpl: innerContext.fetch || globalThis.fetch,
            logger: innerContext.logger,
          });

          if (Object.keys(savePlan.settingsToPersist).length) {
            await innerContext.settingsStore.upsertSettings(savePlan.settingsToPersist);
            applyRuntimeSettings(innerContext.config, savePlan.settingsToPersist);
          }

          redirect(innerRes, buildLiteAdminLocation({
            view,
            message: savePlan.successMessage,
            error: savePlan.errorMessage,
            theme,
            extra: {
              active: "all",
              page: fields.page || 1,
            },
          }));
        })(req, res, context);
      }

      if (req.method === "POST" && url.pathname === "/admin/actions/automation-save") {
        return withAdmin(async (innerReq, innerRes, innerContext) => {
          const { fields } = await parseRequestForm(innerReq);
          const theme = normalizeTheme(fields.theme);
          const view = normalizeLiteAdminView(fields.view);
          const submitted = parseLiteAutomationForm(fields);

          const isEditing = Boolean(submitted.automationId);

          const saved = await innerContext.automationStore.upsertAutomation({
            automation_id: submitted.automationId || undefined,
            ...submitted,
          }, {
            userScope: innerContext.config.memory.userScope,
            timezone: innerContext.config.chat?.timezone || "UTC",
          });

          redirect(innerRes, buildLiteAdminLocation({
            view,
            theme,
            message: `${isEditing ? "Saved" : "Added"} automation "${saved.label}".`,
          }));
        })(req, res, context);
      }

      if (req.method === "POST" && url.pathname === "/admin/actions/automation-delete") {
        return withAdmin(async (innerReq, innerRes, innerContext) => {
          const { fields } = await parseRequestForm(innerReq);
          const theme = normalizeTheme(fields.theme);
          const view = normalizeLiteAdminView(fields.view);

          const deleted = await innerContext.automationStore.deleteAutomationById(fields.automationId, {
            userScope: innerContext.config.memory.userScope,
          });

          redirect(innerRes, buildLiteAdminLocation({
            view,
            theme,
            message: deleted
              ? `Deleted automation "${deleted.label}".`
              : "Nothing was deleted.",
          }));
        })(req, res, context);
      }

      if (req.method === "POST" && url.pathname === "/admin/actions/automation-toggle") {
        return withAdmin(async (innerReq, innerRes, innerContext) => {
          const { fields } = await parseRequestForm(innerReq);
          const theme = normalizeTheme(fields.theme);
          const view = normalizeLiteAdminView(fields.view);
          const existing = await innerContext.automationStore.getAutomationById(fields.automationId, {
            userScope: innerContext.config.memory.userScope,
          });

          if (!existing) {
            redirect(innerRes, buildLiteAdminLocation({
              view,
              theme,
              extra: buildLiteAutomationExtras({
                journalPage: fields.journalPage || 1,
              }),
              error: "Automation not found.",
            }));
            return;
          }

          const saved = await innerContext.automationStore.upsertAutomation({
            automation_id: existing.automationId,
            type: existing.type,
            label: existing.label,
            channel_id: existing.channelId,
            schedule_time: existing.scheduleTime,
            timezone: existing.timezone,
            prompt: existing.prompt,
            enabled: !existing.enabled,
            mention_user: existing.mentionUser,
            user_id: existing.userId || "",
            last_run_at: existing.lastRunAt || "",
            last_error: existing.lastError || "",
          }, {
            userScope: innerContext.config.memory.userScope,
          });

          redirect(innerRes, buildLiteAdminLocation({
            view,
            theme,
            extra: buildLiteAutomationExtras({
              journalPage: fields.journalPage || 1,
            }),
            message: `${saved.enabled ? "Enabled" : "Paused"} automation "${saved.label}".`,
          }));
        })(req, res, context);
      }

      if (req.method === "POST" && url.pathname === "/admin/actions/journal-delete") {
        return withAdmin(async (innerReq, innerRes, innerContext) => {
          const { fields } = await parseRequestForm(innerReq);
          const theme = normalizeTheme(fields.theme);
          const view = normalizeLiteAdminView(fields.view);
          const deleted = await innerContext.journalStore.deleteEntryById(fields.entryId, {
            userScope: innerContext.config.memory.userScope,
          });

          redirect(innerRes, buildLiteAdminLocation({
            view,
            theme,
            extra: buildLiteAutomationExtras({
              journalPage: fields.journalPage || 1,
            }),
            message: deleted
              ? `Deleted journal entry "${deleted.title}".`
              : "Nothing was deleted.",
          }));
        })(req, res, context);
      }

      if (req.method === "POST" && url.pathname === "/admin/actions/register-commands") {
        return withAdmin(async (innerReq, innerRes, innerContext) => {
          const { fields } = await parseRequestForm(innerReq);
          const theme = normalizeTheme(fields.theme);
          const view = normalizeLiteAdminView(fields.view);

          try {
            const result = await registerDiscordCommands({
              config: innerContext.config,
              logger: innerContext.logger,
            });

            redirect(innerRes, buildLiteAdminLocation({
              view,
              theme,
              message: `Registered ${result.commandCount} Discord command${result.commandCount === 1 ? "" : "s"} for guild ${result.guildId}.`,
            }));
            return;
          } catch (error) {
            redirect(innerRes, buildLiteAdminLocation({
              view,
              theme,
              error: error?.message || "Failed to register Discord commands.",
            }));
          }
        })(req, res, context);
      }

      if (req.method === "POST" && url.pathname === "/admin/actions/conversation-prune") {
        return withAdmin(async (innerReq, innerRes, innerContext) => {
          const { fields } = await parseRequestForm(innerReq);
          const theme = normalizeTheme(fields.theme);
          const view = normalizeLiteAdminView(fields.view);

          try {
            const result = await innerContext.conversations.pruneEventsOlderThan({
              olderThanDays: Number(fields.olderThanDays || 0),
              guildId: innerContext.config.discord.guildId || "",
            });

            redirect(innerRes, buildLiteAdminLocation({
              view,
              theme,
              message: result.deletedCount > 0
                ? `Pruned ${result.deletedCount} stored conversation event${result.deletedCount === 1 ? "" : "s"} older than ${fields.olderThanDays} days.`
                : `No stored conversation events were older than ${fields.olderThanDays} days.`,
            }));
          } catch (error) {
            redirect(innerRes, buildLiteAdminLocation({
              view,
              theme,
              error: error?.message || "Failed to prune stored conversations.",
            }));
          }
        })(req, res, context);
      }

      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found.");
    }).catch((error) => {
      logger.error("[http] Request failed", {
        message: error.message,
      });
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Internal server error.");
    });
  });

  server.listen(port, "0.0.0.0", () => {
    logger.info(`[health] HTTP server listening on 0.0.0.0:${port}`);
  });

  return server;
}

module.exports = {
  createHealthServer,
  parseMultipartFormData,
  parseBasicAuthHeader,
  buildMemoryExportPayload,
  buildAppSettingsExportPayload,
  buildMemoryImportRecords,
  normalizeTheme,
  buildAdminLocation,
  renderEntryPage,
  renderLiteAdminPage,
};
