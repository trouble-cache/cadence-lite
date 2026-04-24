const path = require("node:path");
const { extractRuntimeSettings } = require("../config/runtimeSettings");
const { SUPPORTED_MEMORY_DOMAINS } = require("../memory/domains");
const { canSyncMemories } = require("../memory/syncMemories");
const { SUPPORTED_MEMORY_TYPES, SUPPORTED_SENSITIVITY_LEVELS, SUPPORTED_AUTOMATION_TYPES } = require("../storage");
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

function normalizeTheme(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "dark" ? "dark" : "light";
}

function normalizeLiteAdminView(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return LITE_ADMIN_VIEWS.includes(normalized) ? normalized : "settings";
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
    help: normalizedTheme === "dark" ? "cadence_help_dark_icon.svg" : "cadence_help_light_icon.svg",
    patreon: normalizedTheme === "dark" ? "patreon_dark_icon.svg" : "patreon_light_icon.svg",
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

function renderLiteSidebar({ currentView = "settings", theme = "light", themeLinks = null }) {
  const helpDocsLocation = "/docs/Cadence%20Lite%20Setup%20Guide.pdf";
  const supportLocation = "https://www.patreon.com/c/CadenceAI";
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
  const postscriptMarkup = [
    "<nav class=\"sidebar-postscript\" aria-label=\"Support links\">",
    `<a href="${escapeHtml(helpDocsLocation)}" download>`,
    `<span class="sidebar-postscript-mark" aria-hidden="true">${renderIconImage("help", theme, "", "sidebar-postscript-image")}</span>`,
    "<span>Help Docs</span>",
    "</a>",
    `<a href="${escapeHtml(supportLocation)}" target="_blank" rel="noreferrer">`,
    `<span class="sidebar-postscript-mark" aria-hidden="true">${renderIconImage("patreon", theme, "", "sidebar-postscript-image")}</span>`,
    "<span>Support Cadence</span>",
    "</a>",
    "</nav>",
    "<p class=\"sidebar-version\">Cadence Lite v 1.02</p>",
  ].join("");
  const themeMarkup = themeLinks
    ? [
      "<div class=\"sidebar-footer\">",
      postscriptMarkup,
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
    `<a class="sidebar-brand" href="${escapeHtml(buildLiteAdminLocation({ view: "settings", theme }))}">`,
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

function renderLiteMemoryEditorAdminPage({
  config,
  editingMemory = null,
  activeFilter = "active",
  page = 1,
  theme = "light",
  themeLinks = null,
  searchQuery = "",
  memoryTypeFilter = "",
  domainFilter = "",
  sortKey = "updatedAt",
  sortDirection = "desc",
  message = "",
  error = "",
}) {
  return renderLayout({
    title: editingMemory ? "Edit Memory" : "Add Memory",
    body: [
      "<div class=\"admin-shell lite-shell\">",
      renderLiteSidebar({
        currentView: "memories",
        theme,
        themeLinks,
      }),
      `<section class="admin-main lite-main">${renderLiteMemoryEditorPage({
        config,
        editingMemory,
        activeFilter,
        page,
        theme,
        searchQuery,
        memoryTypeFilter,
        domainFilter,
        sortKey,
        sortDirection,
      })}</section>`,
      "</div>",
    ].join(""),
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

module.exports = {
  DURABLE_MEMORY_TYPES,
  normalizeTheme,
  normalizeLiteAdminView,
  getLiteViewFromPath,
  escapeHtml,
  getAssetPath,
  renderIconImage,
  renderConfirmOnSubmit,
  renderEntryPage,
  renderOptions,
  getAutomationTypeLabel,
  renderAutomationTypeOptions,
  buildLiteCategoryOptions,
  withThemeField,
  buildThemeLinks,
  buildAdminLocation,
  buildLiteAdminPath,
  buildLiteAdminLocation,
  formatDateValue,
  formatBytes,
  buildLiteMemoryQueryState,
  buildLiteMemoryExtras,
  buildLiteAutomationExtras,
  renderLiteSettingsPage,
  renderLiteMemoriesPage,
  renderLiteMemoryEditorPage,
  renderLiteMemoryEditorAdminPage,
  renderLiteProactivePage,
  renderLiteAdminPage,
  getMessage,
  getError,
};
