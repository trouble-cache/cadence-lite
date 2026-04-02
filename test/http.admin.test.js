const test = require("node:test");
const assert = require("node:assert/strict");

const {
  parseBasicAuthHeader,
  parseMultipartFormData,
  buildMemoryExportPayload,
  buildAppSettingsExportPayload,
  buildMemoryImportRecords,
  normalizeTheme,
  buildAdminLocation,
  renderEntryPage,
  renderLiteAdminPage,
} = require("../src/http/createHealthServer");

test("parseBasicAuthHeader extracts username and password", () => {
  const value = `Basic ${Buffer.from("georgia:secret-pass").toString("base64")}`;
  assert.deepEqual(parseBasicAuthHeader(value), {
    username: "georgia",
    password: "secret-pass",
  });
});

test("parseMultipartFormData reads text fields and uploaded file content", () => {
  const boundary = "----cadence-boundary";
  const body = Buffer.from(
    [
      `--${boundary}`,
      'Content-Disposition: form-data; name="sourceLabel"',
      "",
      "Old ChatGPT thread",
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="import.md"',
      "Content-Type: text/markdown",
      "",
      "---\ntitle: Test\ncontent: hello\n---",
      `--${boundary}--`,
      "",
    ].join("\r\n"),
    "utf8",
  );

  const parsed = parseMultipartFormData(body, `multipart/form-data; boundary=${boundary}`);

  assert.equal(parsed.fields.sourceLabel, "Old ChatGPT thread");
  assert.equal(parsed.files.file.filename, "import.md");
  assert.match(parsed.files.file.content, /title: Test/);
});

test("normalizeTheme defaults unknown values to light", () => {
  assert.equal(normalizeTheme("dark"), "dark");
  assert.equal(normalizeTheme("LIGHT"), "light");
  assert.equal(normalizeTheme("mist"), "light");
});

test("buildAdminLocation preserves theme and extra query parameters", () => {
  assert.equal(
    buildAdminLocation({
      theme: "dark",
      message: "Saved",
      extra: {
        active: "all",
        edit: "abc",
      },
    }),
    "/admin?active=all&edit=abc&theme=dark&message=Saved",
  );
});

test("renderEntryPage gives the root url a proper admin front door", () => {
  const page = renderEntryPage({
    config: {},
    ready: true,
    theme: "dark",
  });

  assert.match(page, /Cadence Lite/);
  assert.match(page, /Open Admin/);
  assert.match(page, /System Status/);
  assert.match(page, /\/admin\?theme=dark/);
  assert.match(page, /Your AI lives in Discord/);
  assert.match(page, /patreon\.com\/c\/CadenceAI/);
  assert.match(page, /data-theme="dark"/);
});

test("renderLiteAdminPage shows the settings view with persisted runtime controls", () => {
  const page = renderLiteAdminPage({
    config: {
      llm: {
        chat: { provider: "openrouter", model: "openai/gpt-5.4" },
        image: { provider: "openrouter", model: "anthropic/claude-sonnet-4.6" },
        embedding: { provider: "openrouter", model: "text-embedding-3-small" },
        transcription: { provider: "openrouter", model: "gpt-4o-mini-transcribe" },
      },
      chat: {
        defaultMode: "default",
        historyLimit: 14,
        promptBlocks: {
          personaName: "Cadence",
          userName: "Georgia",
        },
      },
      qdrant: {
        url: "http://qdrant.test",
      },
    },
    memories: [
      {
        memoryId: "mem-1",
        title: "Evening routine",
        content: "She settles better if she gets a quiet check-in before bed.",
        memoryType: "anchor",
        domain: "routines",
        sensitivity: "low",
        active: true,
        updatedAt: "2026-03-24T10:00:00.000Z",
      },
    ],
    page: 2,
    pageSize: 10,
    totalMemories: 37,
    conversationStorage: {
      eventCount: 412,
      messageEventCount: 287,
      oldestEventAt: "2026-02-01T09:00:00.000Z",
      newestEventAt: "2026-03-28T08:00:00.000Z",
      conversationBytes: 1048576,
      databaseBytes: 5242880,
    },
    message: "Saved settings",
    error: "Core-only feature",
    theme: "dark",
    themeLinks: {
      light: "/admin?theme=light",
      dark: "/admin?theme=dark",
    },
    currentView: "settings",
  });

  assert.match(page, /Cadence Lite Admin/);
  assert.match(page, /<strong>Cadence Lite<\/strong>/);
  assert.match(page, /Dashboard/);
  assert.match(page, /Default Models/);
  assert.match(page, /Backup &amp; Restore Memories/);
  assert.match(page, /Import Memories/);
  assert.match(page, /Export Memories/);
  assert.match(page, /Backup App Settings/);
  assert.match(page, /Export App Settings/);
  assert.match(page, /saved settings, automations, and journals/i);
  assert.match(page, /does not include durable memories or conversation history/i);
  assert.match(page, /\/admin\/exports\/app-settings\?theme=dark/);
  assert.match(page, /Rebuild Memory Index/);
  assert.match(page, /This does not delete the source memories stored in Postgres/i);
  assert.match(page, /Setup &amp; Maintenance/);
  assert.match(page, /Register Discord Commands/);
  assert.match(page, /Chat Storage/);
  assert.match(page, /Prune Old Conversations/);
  assert.match(page, /1\.0 MB/);
  assert.match(page, /5\.0 MB/);
  assert.match(page, /Voice & Tone/);
  assert.match(page, /Recent Chat Context/);
  assert.match(page, /value="14"/);
  assert.match(page, /Transcription/);
  assert.match(page, /anthropic\/claude-sonnet-4\.6/);
  assert.doesNotMatch(page, /<select id="chatProvider"/);
  assert.doesNotMatch(page, /<strong>Summaries<\/strong>/);
  assert.match(page, /maxlength="100"/);
  assert.match(page, /maxlength="1000"/);
  assert.match(page, /First-time setup: If you.*starting from scratch.*one test memory/i);
  assert.match(page, /Save Settings/);
  assert.match(page, /Saved settings/);
  assert.match(page, /Core-only feature/);
  assert.match(page, /data-theme="dark"/);
  assert.match(page, /\/admin\/memories\?theme=dark/);
});

test("renderLiteAdminPage shows the memory desk as a compact table", () => {
  const page = renderLiteAdminPage({
    config: {
      llm: {
        chat: { provider: "openrouter", model: "gpt-5.4" },
      },
      chat: {
        defaultMode: "default",
        historyLimit: 8,
        promptBlocks: {
          personaName: "Cadence",
          userName: "Georgia",
        },
      },
      qdrant: {
        url: "http://qdrant.test",
      },
    },
    memories: [
      {
        memoryId: "mem-1",
        title: "Evening routine",
        content: "She settles better if she gets a quiet check-in before bed.",
        memoryType: "anchor",
        domain: "routines",
        sensitivity: "low",
        active: true,
        updatedAt: "2026-03-24T10:00:00.000Z",
      },
    ],
    page: 2,
    pageSize: 10,
    totalMemories: 37,
    searchQuery: "",
    memoryTypeFilter: "",
    domainFilter: "",
    showComposer: false,
    theme: "dark",
    themeLinks: {
      light: "/admin/memories?theme=light",
      dark: "/admin/memories?theme=dark",
    },
    currentView: "memories",
  });

  assert.match(page, /Search memories\.\.\./);
  assert.match(page, /Add New Memory/);
  assert.match(page, /Evening routine/);
  assert.match(page, /Title/);
  assert.match(page, /Type/);
  assert.match(page, /Category/);
  assert.match(page, /Updated/);
  assert.match(page, /sort=updatedAt/);
  assert.match(page, /Resync/);
  assert.match(page, /Page 2 of 4/);
  assert.match(page, /\/admin\/memories\?/);
  assert.match(page, /theme=dark/);
});

test("buildMemoryExportPayload keeps durable memory fields useful for export", () => {
  const payload = buildMemoryExportPayload({
    config: {},
    memories: [
      {
        memoryId: "mem-1",
        title: "Evening routine",
        content: "She settles better if she gets a quiet check-in before bed.",
        memoryType: "anchor",
        domain: "routines",
        sensitivity: "low",
        source: "manual_admin",
        active: true,
        referenceDate: null,
        createdAt: "2026-03-24T10:00:00.000Z",
        updatedAt: "2026-03-25T12:00:00.000Z",
      },
    ],
  });

  assert.equal(payload.product, "cadence-lite");
  assert.equal(payload.memoryCount, 1);
  assert.equal(payload.memories[0].memoryId, "mem-1");
  assert.equal(payload.memories[0].domain, "routines");
  assert.equal(payload.memories[0].source, "manual_admin");
  assert.equal(payload.memories[0].active, true);
});

test("buildMemoryImportRecords accepts export-shaped JSON and leaves blank ids unset", () => {
  const records = buildMemoryImportRecords({
    fields: {},
    files: {
      file: {
        filename: "cadence-memories.json",
        content: JSON.stringify({
          memories: [
            {
              memoryId: "",
              title: "Evening routine",
              content: "She settles better if she gets a quiet check-in before bed.",
              memoryType: "anchor",
              domain: "routines",
              sensitivity: "low",
              source: "manual_admin",
              active: true,
            },
          ],
        }),
      },
    },
  });

  assert.equal(records.length, 1);
  assert.equal(records[0].memory_id, undefined);
  assert.equal(records[0].memory_type, "anchor");
  assert.equal(records[0].domain, "routines");
  assert.equal(records[0].source, "manual_admin");
});

test("buildAppSettingsExportPayload keeps non-memory app data useful for backup", () => {
  const payload = buildAppSettingsExportPayload({
    config: {},
    settings: {
      "chat.timezone": "Europe/London",
      "chat.historyLimit": 16,
    },
    automations: [
      {
        automationId: "auto-1",
        userScope: "discord:georgia",
        type: "check_in",
        label: "Morning check-in",
        channelId: "123456",
        scheduleTime: "09:30",
        timezone: "Europe/London",
        prompt: "Send a check-in.",
        enabled: true,
        mentionUser: false,
        userId: null,
        lastRunAt: "2026-03-29T08:30:00.000Z",
        lastError: "",
        createdAt: "2026-03-20T08:00:00.000Z",
        updatedAt: "2026-03-29T08:30:00.000Z",
      },
    ],
    journalEntries: [
      {
        entryId: "journal-1",
        userScope: "discord:georgia",
        automationId: "auto-1",
        channelId: "123456",
        guildId: "654321",
        title: "Journal entry",
        content: "A continuity note.",
        createdAt: "2026-03-29T21:00:00.000Z",
      },
    ],
  });

  assert.equal(payload.product, "cadence-lite");
  assert.equal(payload.exportType, "app_settings");
  assert.deepEqual(payload.includes, ["app_settings", "automations", "journal_entries"]);
  assert.deepEqual(payload.counts, {
    settings: 2,
    automations: 1,
    journalEntries: 1,
  });
  assert.equal(payload.settings["chat.timezone"], "Europe/London");
  assert.equal(payload.automations[0].automationId, "auto-1");
  assert.equal(payload.journalEntries[0].entryId, "journal-1");
  assert.equal("memories" in payload, false);
  assert.equal("conversationHistory" in payload, false);
});

test("renderLiteAdminPage shows the proactive shell", () => {
  const page = renderLiteAdminPage({
    config: {
      llm: {
        chat: { provider: "openrouter", model: "gpt-5.4" },
      },
      chat: {
        historyLimit: 8,
        timezone: "Europe/London",
        promptBlocks: {},
      },
      qdrant: {
        url: "",
      },
    },
    automations: [
      {
        automationId: "auto-1",
        type: "check_in",
        label: "Morning check-in",
        channelId: "123456789",
        scheduleTime: "09:30",
        timezone: "Europe/London",
        prompt: "Send a gentle check-in.",
        enabled: true,
        mentionUser: true,
        userId: "5555",
      },
    ],
    journalEntries: [
      {
        entryId: "journal-1",
        title: "Journal — 28 March",
        content: "A little continuity note.",
        createdAt: "2026-03-28T22:10:00.000Z",
      },
    ],
    theme: "light",
    themeLinks: {
      light: "/admin/proactive?theme=light",
      dark: "/admin/proactive?theme=dark",
    },
    currentView: "proactive",
  });

  assert.match(page, /Scheduled Actions/);
  assert.match(page, /Morning check-in/);
  assert.match(page, /Add Automation/);
  assert.match(page, /Recent Journals/);
  assert.match(page, /Journal — 28 March/);
  assert.match(page, /Channel ID/);
  assert.match(page, /Time/);
  assert.doesNotMatch(page, /Timezone/);
  assert.match(page, /Type/);
});
