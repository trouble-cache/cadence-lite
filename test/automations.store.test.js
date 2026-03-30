const test = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeTimezone,
  normalizeAutomationRecord,
  mapAutomationRow,
  SUPPORTED_AUTOMATION_TYPES,
} = require("../src/storage/automations");

test("SUPPORTED_AUTOMATION_TYPES matches Lite automation v1", () => {
  assert.deepEqual(SUPPORTED_AUTOMATION_TYPES, ["journal", "check_in"]);
});

test("normalizeAutomationRecord accepts a valid check-in automation", () => {
  const normalized = normalizeAutomationRecord({
    type: "check_in",
    label: "Morning check-in",
    channel_id: "1234567890",
    schedule_time: "09:30",
    timezone: "Europe/London",
    prompt: "Send a gentle morning check-in.",
    mention_user: true,
    user_id: "5555",
  }, {
    userScope: "georgia",
  });

  assert.equal(normalized.userScope, "georgia");
  assert.equal(normalized.type, "check_in");
  assert.equal(normalized.label, "Morning check-in");
  assert.equal(normalized.channelId, "1234567890");
  assert.equal(normalized.scheduleTime, "09:30");
  assert.equal(normalized.timezone, "Europe/London");
  assert.equal(normalized.mentionUser, true);
  assert.equal(normalized.userId, "5555");
});

test("normalizeAutomationRecord falls back to the default timezone", () => {
  const normalized = normalizeAutomationRecord({
    type: "check_in",
    label: "Morning check-in",
    channel_id: "1234567890",
    schedule_time: "09:30",
    prompt: "Send a gentle morning check-in.",
  }, {
    userScope: "georgia",
    timezone: "Europe/London",
  });

  assert.equal(normalized.timezone, "Europe/London");
});

test("normalizeTimezone accepts GMT offsets and normalizes them to fixed-offset zones", () => {
  assert.equal(normalizeTimezone("GMT+1"), "Etc/GMT-1");
  assert.equal(normalizeTimezone("UTC-3"), "Etc/GMT+3");
  assert.equal(normalizeTimezone("UTC"), "UTC");
});

test("normalizeAutomationRecord allows empty journal prompt but not missing check-in user ids when mentioning", () => {
  const journal = normalizeAutomationRecord({
    type: "journal",
    label: "Evening reflection",
    channel_id: "journal-thread",
    schedule_time: "21:15",
    timezone: "Europe/London",
    prompt: "",
  }, {
    userScope: "georgia",
  });

  assert.equal(journal.prompt, "");

  assert.throws(() => normalizeAutomationRecord({
    type: "check_in",
    label: "Ping",
    channel_id: "channel-1",
    schedule_time: "08:00",
    timezone: "Europe/London",
    prompt: "hello",
    mention_user: true,
  }, {
    userScope: "georgia",
  }), /User ID is required/);

  assert.throws(() => normalizeAutomationRecord({
    type: "journal",
    label: "Broken timezone",
    channel_id: "journal-thread",
    schedule_time: "21:15",
    timezone: "Moon\\/Atlantic",
    prompt: "",
  }, {
    userScope: "georgia",
  }), /Invalid timezone/);
});

test("mapAutomationRow exposes persisted automation fields", () => {
  const mapped = mapAutomationRow({
    id: "4",
    automation_id: "abc-123",
    user_scope: "georgia",
    type: "journal",
    label: "Evening reflection",
    channel_id: "123456",
    schedule_time: "21:15",
    timezone: "Europe/London",
    prompt: "",
    enabled: true,
    mention_user: false,
    user_id: null,
    last_run_at: "2026-03-28T21:15:00.000Z",
    last_error: "",
    created_at: "2026-03-27T12:00:00.000Z",
    updated_at: "2026-03-28T12:00:00.000Z",
  });

  assert.deepEqual(mapped, {
    id: 4,
    automationId: "abc-123",
    userScope: "georgia",
    type: "journal",
    label: "Evening reflection",
    channelId: "123456",
    scheduleTime: "21:15",
    timezone: "Europe/London",
    prompt: "",
    enabled: true,
    mentionUser: false,
    userId: null,
    lastRunAt: "2026-03-28T21:15:00.000Z",
    lastError: "",
    createdAt: "2026-03-27T12:00:00.000Z",
    updatedAt: "2026-03-28T12:00:00.000Z",
  });
});
