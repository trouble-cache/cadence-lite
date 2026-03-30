const test = require("node:test");
const assert = require("node:assert/strict");

const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const {
  ensureMemoryNoteId,
  parseMemoryNote,
} = require("../src/memory/importNotes");
const {
  DEFAULT_IMPORTANCE_BY_TYPE,
  normalizeDomain,
  normalizeMemoryRecord,
} = require("../src/storage/memories");

test("normalizeDomain converts loose labels into stable keys", () => {
  assert.equal(normalizeDomain("Projects"), "projects");
  assert.equal(normalizeDomain("Recent Events"), "recent_events");
  assert.equal(normalizeDomain("Health"), "health");
});

test("normalizeMemoryRecord applies defaults and generates a UUID when missing", () => {
  const record = normalizeMemoryRecord({
    title: "Knee Pain",
    content: "Left knee pain has been lingering for several weeks.",
    memory_type: "canon",
    domain: "Health",
    sensitivity: "low",
  }, {
    source: "manual_import",
    userScope: "georgia",
  });

  assert.match(record.memoryId, /^[0-9a-f-]{36}$/);
  assert.equal(record.memoryType, "canon");
  assert.equal(record.domain, "health");
  assert.equal(record.source, "manual_import");
  assert.equal(record.userScope, "georgia");
  assert.equal(record.referenceDate, null);
  assert.equal(record.importance, DEFAULT_IMPORTANCE_BY_TYPE.canon);
  assert.equal(record.active, true);
});

test("normalizeMemoryRecord preserves explicit reference dates", () => {
  const record = normalizeMemoryRecord({
    title: "Yesterday's breakthrough",
    content: "Georgia untangled the memory staging flow.",
    memory_type: "resolved",
    domain: "projects",
    sensitivity: "low",
    reference_date: "2026-03-22T11:15:00.000Z",
  }, {
    source: "staged_manual_import",
    userScope: "georgia",
  });

  assert.equal(record.referenceDate, "2026-03-22");
});

test("normalizeMemoryRecord rejects non-lite memory types", () => {
  assert.throws(() => normalizeMemoryRecord({
    title: "Threshold Banter",
    content: "A recurring roleplay thread with moody sci-fi tension.",
    memory_type: "roleplay",
    domain: "lore",
    sensitivity: "low",
  }, {
    source: "manual_import",
    userScope: "georgia",
  }), /Unsupported memory_type/);

  assert.throws(() => normalizeMemoryRecord({
    title: "Timeline — 2026-03-22",
    content: "A compact continuity log of the day.",
    memory_type: "timeline_daily",
    domain: "timeline",
    sensitivity: "low",
  }, {
    source: "staged_manual_import",
    userScope: "georgia",
  }), /Unsupported memory_type/);

  assert.throws(() => normalizeMemoryRecord({
    title: "Weekly — 2026-03-22",
    content: "A higher-level continuity log of the week.",
    memory_type: "timeline_weekly",
    domain: "timeline",
    sensitivity: "low",
  }, {
    source: "staged_manual_import",
    userScope: "georgia",
  }), /Unsupported memory_type/);
});

test("parseMemoryNote reads frontmatter content and ignores sync log body text", () => {
  const note = [
    "---",
    "title: Knee Pain",
    "id: 9a174db6-0755-11f1-9ffb-325096b39f47",
    "text: As of Mar 2026 Georgia reports several weeks of left knee pain.",
    "type: canon",
    "domain: health",
    "sensitivity: low",
    "---",
    "As of Mar 2026 Georgia reports several weeks of left knee pain.",
    "",
    "---",
    "- 2026-03-16T07:20:08.413+00:00: ✅ Synced to Qdrant",
  ].join("\n");

  const parsed = parseMemoryNote(note, "/tmp/Knee Pain.md");

  assert.deepEqual(parsed, {
    memoryId: "9a174db6-0755-11f1-9ffb-325096b39f47",
    title: "Knee Pain",
    content: "As of Mar 2026 Georgia reports several weeks of left knee pain.",
    memoryType: "canon",
    domain: "health",
    sensitivity: "low",
    source: "manual_import",
    active: undefined,
    importance: undefined,
    createdAt: undefined,
    updatedAt: undefined,
    lastUsedAt: "",
  });
});

test("parseMemoryNote supports multiline YAML block content", () => {
  const note = [
    "---",
    "title: Solstice Crisis & Collapse",
    "content: |-",
    "  First paragraph.",
    "",
    "  Second paragraph.",
    "type: resolved",
    "domain: stressors",
    "sensitivity: medium",
    "---",
    "Body text fallback that should not be used.",
  ].join("\n");

  const parsed = parseMemoryNote(note, "/tmp/Solstice Crisis & Collapse.md");

  assert.equal(parsed.content, "First paragraph.\n\nSecond paragraph.");
  assert.equal(parsed.memoryType, "resolved");
  assert.equal(parsed.domain, "stressors");
  assert.equal(parsed.sensitivity, "medium");
});

test("ensureMemoryNoteId writes a generated id back into frontmatter when missing", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "cadence-memory-"));
  const notePath = path.join(tempDir, "Clooney-Like.md");
  const note = [
    "---",
    "title: Clooney-Like",
    "text: Cadence has a Clooney-like quality in certain moods.",
    "type: anchor",
    "domain: lore",
    "sensitivity: low",
    "---",
    "Cadence has a Clooney-like quality in certain moods.",
  ].join("\n");

  await fs.writeFile(notePath, note, "utf8");

  const record = await ensureMemoryNoteId(notePath);
  const updatedText = await fs.readFile(notePath, "utf8");

  assert.match(record.memoryId, /^[0-9a-f-]{36}$/);
  assert.match(updatedText, /id: [0-9a-f-]{36}/);
});
