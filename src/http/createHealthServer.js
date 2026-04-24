const fs = require("node:fs/promises");
const http = require("http");
const path = require("node:path");
const { buildMemoryImportRecords, ADMIN_POST_ACTIONS } = require("./adminActions");
const { loadLiteAdminPageData } = require("./adminPageData");
const {
  buildMemoryExportPayload,
  buildAppSettingsExportPayload,
  streamMemoryExport,
  streamAppSettingsExport,
  streamConversationEventsCsvExport,
  streamConversationLogsExport,
} = require("./adminExports");
const {
  parseBasicAuthHeader,
  isAuthorized,
  sendAuthRequired,
  redirect,
  parseMultipartFormData,
} = require("./adminHttp");
const {
  DURABLE_MEMORY_TYPES,
  normalizeTheme,
  getAssetPath,
  buildAdminLocation,
  buildLiteAdminLocation,
  renderEntryPage,
  renderLiteMemoryEditorAdminPage,
  renderLiteAdminPage,
} = require("./adminUi");

const ASSET_CONTENT_TYPES = Object.freeze({
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
});
const DOCS_CONTENT_TYPES = Object.freeze({
  ".pdf": "application/pdf",
});

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
          await streamMemoryExport({
            res: innerRes,
            context: innerContext,
            durableMemoryTypes: DURABLE_MEMORY_TYPES,
          });
        })(req, res, context);
      }

      if (req.method === "GET" && url.pathname === "/admin/exports/app-settings") {
        return withAdmin(async (_req, innerRes, innerContext) => {
          await streamAppSettingsExport({
            res: innerRes,
            context: innerContext,
          });
        })(req, res, context);
      }

      if (req.method === "GET" && url.pathname === "/admin/exports/conversation-events.csv") {
        return withAdmin(async (_req, innerRes, innerContext) => {
          await streamConversationEventsCsvExport({
            res: innerRes,
            context: innerContext,
          });
        })(req, res, context);
      }

      if (req.method === "GET" && url.pathname === "/admin/exports/conversation-logs") {
        return withAdmin(async (_req, innerRes, innerContext) => {
          await streamConversationLogsExport({
            res: innerRes,
            context: innerContext,
          });
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

      if (req.method === "GET" && url.pathname.startsWith("/docs/")) {
        const docName = path.basename(decodeURIComponent(url.pathname));
        const docPath = path.join(process.cwd(), "docs", docName);

        if (docName !== "Cadence Lite Setup Guide.pdf") {
          res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("Document not found.");
          return;
        }

        try {
          const content = await fs.readFile(docPath);
          const contentType = DOCS_CONTENT_TYPES[path.extname(docName).toLowerCase()] || "application/octet-stream";
          res.writeHead(200, {
            "Content-Type": contentType,
            "Content-Disposition": `attachment; filename="${docName}"`,
            "Cache-Control": "no-store",
          });
          res.end(content);
        } catch (_error) {
          res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("Document not found.");
        }
        return;
      }

      if (req.method === "GET" && (url.pathname === "/admin" || url.pathname === "/admin/memories" || url.pathname === "/admin/proactive" || url.pathname === "/admin/memories/new" || url.pathname === "/admin/memories/edit")) {
        return withAdmin(async (_req, innerRes, innerContext) => {
          const pageData = await loadLiteAdminPageData({
            url,
            context: innerContext,
          });

          innerRes.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });

          if (pageData.currentView === "memory-editor") {
            innerRes.end(renderLiteMemoryEditorAdminPage({
              config: innerContext.config,
              editingMemory: pageData.editingMemory,
              activeFilter: pageData.activeFilter,
              page: pageData.page,
              theme: pageData.theme,
              themeLinks: pageData.themeLinks,
              searchQuery: pageData.searchQuery,
              memoryTypeFilter: pageData.memoryTypeFilter,
              domainFilter: pageData.domainFilter,
              sortKey: pageData.sortKey,
              sortDirection: pageData.sortDirection,
              message: pageData.message,
              error: pageData.error,
            }));
            return;
          }

          innerRes.end(renderLiteAdminPage({
            config: innerContext.config,
            memories: pageData.memories,
            automations: pageData.automations,
            journalEntries: pageData.journalEntries,
            editingAutomation: pageData.editingAutomation,
            activeFilter: pageData.activeFilter,
            page: pageData.page,
            pageSize: pageData.pageSize,
            totalMemories: pageData.totalMemories,
            searchQuery: pageData.searchQuery,
            memoryTypeFilter: pageData.memoryTypeFilter,
            domainFilter: pageData.domainFilter,
            sortKey: pageData.sortKey,
            sortDirection: pageData.sortDirection,
            conversationStorage: pageData.conversationStorage,
            message: pageData.message,
            error: pageData.error,
            theme: pageData.theme,
            themeLinks: pageData.themeLinks,
            currentView: pageData.currentView,
            journalPage: pageData.journalPage,
            journalTotalPages: pageData.journalTotalPages,
          }));
        })(req, res, context);
      }

      const adminPostAction = ADMIN_POST_ACTIONS[url.pathname];

      if (req.method === "POST" && adminPostAction) {
        return withAdmin(async (innerReq, innerRes, innerContext) => {
          await adminPostAction(innerReq, innerRes, innerContext);
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
