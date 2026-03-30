const test = require("node:test");
const assert = require("node:assert/strict");

const { normalizeJournalEntryRecord } = require("../src/storage/journals");

test("normalizeJournalEntryRecord accepts a valid journal entry", () => {
  const normalized = normalizeJournalEntryRecord({
    automation_id: "auto-1",
    channel_id: "channel-1",
    guild_id: "guild-1",
    title: "Evening reflection",
    content: "A grounded little journal entry.",
    created_at: "2026-03-28T20:15:00.000Z",
  }, {
    userScope: "georgia",
  });

  assert.equal(normalized.userScope, "georgia");
  assert.equal(normalized.automationId, "auto-1");
  assert.equal(normalized.channelId, "channel-1");
  assert.equal(normalized.guildId, "guild-1");
  assert.equal(normalized.title, "Evening reflection");
  assert.equal(normalized.content, "A grounded little journal entry.");
  assert.equal(normalized.createdAt, "2026-03-28T20:15:00.000Z");
});
