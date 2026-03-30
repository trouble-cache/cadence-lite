const test = require("node:test");
const assert = require("node:assert/strict");

const {
  mapMemoryRow,
} = require("../src/storage/memories");

test("mapMemoryRow exposes usage metadata from Postgres rows", () => {
  const mapped = mapMemoryRow({
    id: "7",
    memory_id: "abc-123",
    title: "Cadence",
    content: "A sticky old memory.",
    memory_type: "resolved",
    domain: "systems",
    sensitivity: "low",
    source: "manual_import",
    active: true,
    importance: "3",
    user_scope: "georgia",
    reference_date: "2026-03-24",
    created_at: "2026-03-20T10:00:00.000Z",
    updated_at: "2026-03-24T10:00:00.000Z",
    last_used_at: "2026-03-24T12:00:00.000Z",
    use_count: "9",
  });

  assert.deepEqual(mapped, {
    id: 7,
    memoryId: "abc-123",
    title: "Cadence",
    content: "A sticky old memory.",
    memoryType: "resolved",
    domain: "systems",
    sensitivity: "low",
    source: "manual_import",
    active: true,
    importance: 3,
    userScope: "georgia",
    referenceDate: "2026-03-24",
    createdAt: "2026-03-20T10:00:00.000Z",
    updatedAt: "2026-03-24T10:00:00.000Z",
    lastUsedAt: "2026-03-24T12:00:00.000Z",
    useCount: 9,
  });
});
