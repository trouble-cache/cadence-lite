const adminStyles = require("./adminStyles");

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeTheme(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "dark" ? "dark" : "light";
}

function renderLayout({
  title,
  body,
  message = "",
  error = "",
  theme = "light",
  themeLinks = null,
  hideTitle = false,
  hideTopbar = false,
}) {
  const notice = message ? `<p class="notice success">${escapeHtml(message)}</p>` : "";
  const warning = error ? `<p class="notice error">${escapeHtml(error)}</p>` : "";
  const activeTheme = normalizeTheme(theme);
  const themeSwitcher = themeLinks
    ? [
      "<div class=\"theme-switcher\" aria-label=\"Theme toggle\">",
      `<a href="${escapeHtml(themeLinks.light)}"${activeTheme === "light" ? " aria-current=\"page\"" : ""}>Light</a>`,
      `<a href="${escapeHtml(themeLinks.dark)}"${activeTheme === "dark" ? " aria-current=\"page\"" : ""}>Dark</a>`,
      "</div>",
    ].join("")
    : "";

  return [
    "<!doctype html>",
    `<html lang="en" data-theme="${escapeHtml(activeTheme)}">`,
    "<head>",
    "<meta charset=\"utf-8\">",
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">",
    `<title>${escapeHtml(title)}</title>`,
    "<style>",
    adminStyles,
    "</style>",
    "</head>",
    "<body>",
    "<main>",
    hideTopbar
      ? ""
      : [
        "<div class=\"topbar\">",
        hideTitle ? "" : `<div class="title-block"><h1>${escapeHtml(title)}</h1></div>`,
        themeSwitcher,
        "</div>",
      ].join(""),
    notice,
    warning,
    body,
    "</main>",
    "</body>",
    "</html>",
  ].join("");
}

function renderEntryPage({ config, ready = false, theme = "light", renderIconImage }) {
  const productLabel = "Cadence Lite";
  const activeTheme = normalizeTheme(theme);
  const adminHref = `/admin?theme=${encodeURIComponent(activeTheme)}`;
  const logo = renderIconImage("logo", activeTheme, "Cadence logo", "entry-logo-image");

  const body = [
    "<section class=\"entry-shell\">",
    "<a class=\"entry-brand\" href=\"https://www.patreon.com/c/CadenceAI\" target=\"_blank\" rel=\"noreferrer\">",
    `<span class="entry-logo">${logo}</span>`,
    "</a>",
    `<h1 class="entry-title">${escapeHtml(productLabel)}</h1>`,
    "<p class=\"entry-copy\">Your AI lives in Discord. This admin space is where you manage setup, memories, and the maintenance behind-the-scenes.</p>",
    "<div class=\"entry-actions\">",
    `<a class="button-link" href="${escapeHtml(adminHref)}">Open Admin</a>`,
    `<a class="button-link button-link-secondary" href="/health">${ready ? "System Status" : "Starting Up"}</a>`,
    "</div>",
    "</section>",
  ].join("");

  return renderLayout({
    title: `${productLabel} Entry`,
    body,
    theme,
    themeLinks: null,
    hideTitle: true,
  });
}

module.exports = {
  renderLayout,
  renderEntryPage,
};
