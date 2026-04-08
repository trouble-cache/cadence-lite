const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildAutomationInput,
  buildJournalSliceMemoryQuery,
  isAutomationDueNow,
  automationRanToday,
  pickRandomContiguousWindow,
  selectJournalConversationSlices,
} = require("../src/automations");

test("buildAutomationInput creates a small synthetic trigger message", () => {
  const input = buildAutomationInput({
    automation: {
      automationId: "auto-1",
      label: "Morning check-in",
      channelId: "123",
    },
  });

  assert.equal(input.content, "Scheduled action: Morning check-in");
  assert.equal(input.authorId, "cadence-automation");
  assert.equal(input.channelId, "123");
  assert.deepEqual(input.inputTypes, ["text"]);
});

test("buildAutomationInput uses a journal-specific trigger label", () => {
  const input = buildAutomationInput({
    automation: {
      automationId: "auto-2",
      label: "Evening reflection",
      channelId: "456",
      type: "journal",
    },
  });

  assert.equal(input.content, "Scheduled journal: Evening reflection");
});

test("automationRanToday compares dates in the automation timezone", () => {
  const automation = {
    timezone: "Europe/London",
    lastRunAt: "2026-03-28T08:00:00.000Z",
  };

  assert.equal(automationRanToday(automation, new Date("2026-03-28T20:00:00.000Z")), true);
  assert.equal(automationRanToday(automation, new Date("2026-03-29T08:00:00.000Z")), false);
});

test("isAutomationDueNow only fires enabled daily automations once per day at the configured minute", () => {
  const base = {
    type: "check_in",
    enabled: true,
    scheduleTime: "09:30",
    timezone: "Europe/London",
    lastRunAt: null,
  };

  assert.equal(isAutomationDueNow(base, new Date("2026-03-28T09:30:00.000Z")), true);
  assert.equal(isAutomationDueNow(base, new Date("2026-03-28T09:31:00.000Z")), false);
  assert.equal(isAutomationDueNow({ ...base, type: "journal" }, new Date("2026-03-28T09:30:00.000Z")), true);
  assert.equal(isAutomationDueNow({ ...base, lastRunAt: "2026-03-28T08:15:00.000Z" }, new Date("2026-03-28T09:30:00.000Z")), false);
});

test("selectJournalConversationSlices excludes the journal channel and keeps coherent excerpts", () => {
  const slices = selectJournalConversationSlices({
    now: new Date("2026-03-28T22:00:00.000Z"),
    excludedChannelId: "journal-channel",
    randomFn: () => 0,
    events: [
      {
        conversation_id: "journal-channel",
        channel_id: "journal-channel",
        event_type: "message",
        role: "assistant",
        author_name: "Cadence",
        content_text: "Earlier journal entry.",
        metadata: { channelName: "journal" },
        created_at: "2026-03-28T21:00:00.000Z",
      },
      {
        conversation_id: "conv-1",
        channel_id: "channel-1",
        event_type: "message",
        role: "user",
        author_name: "User",
        content_text: "We were talking about release prep.",
        metadata: { channelName: "release-room" },
        created_at: "2026-03-28T20:00:00.000Z",
      },
      {
        conversation_id: "conv-1",
        channel_id: "channel-1",
        event_type: "message",
        role: "assistant",
        author_name: "Cadence",
        content_text: "And trying not to lose our minds about it.",
        metadata: { channelName: "release-room" },
        created_at: "2026-03-28T20:01:00.000Z",
      },
      {
        conversation_id: "conv-2",
        channel_id: "channel-2",
        event_type: "message",
        role: "user",
        author_name: "User",
        content_text: "Then we swerved into automations.",
        metadata: { channelName: "workshop" },
        created_at: "2026-03-28T18:00:00.000Z",
      },
      {
        conversation_id: "conv-2",
        channel_id: "channel-2",
        event_type: "message",
        role: "assistant",
        author_name: "Cadence",
        content_text: "Which, annoyingly, went rather well.",
        metadata: { channelName: "workshop" },
        created_at: "2026-03-28T18:01:00.000Z",
      },
    ],
  });

  assert.equal(slices.length, 2);
  assert.equal(slices[0].label, "workshop");
  assert.equal(slices[1].label, "release-room");
  assert.equal(slices.some((slice) => slice.label === "journal"), false);
  assert.equal(slices[0].events.length, 2);
  assert.equal(slices[1].events.length, 2);
});

test("pickRandomContiguousWindow can select a non-tail slice from a long conversation", () => {
  const window = pickRandomContiguousWindow(
    ["a", "b", "c", "d", "e"],
    2,
    () => 0.49,
  );

  assert.deepEqual(window, ["b", "c"]);
});

test("buildJournalSliceMemoryQuery aligns journal memories to the selected slice", () => {
  const query = buildJournalSliceMemoryQuery({
    slice: {
      events: [
        {
          role: "user",
          event_type: "message",
          content_text: "Morning wobble.",
        },
        {
          role: "assistant",
          event_type: "message",
          content_text: "We steadied it.",
        },
        {
          role: "user",
          event_type: "message",
          content_text: "Evening reflection.",
        },
      ],
    },
    input: {
      content: "Scheduled journal: Evening reflection",
    },
    mode: {
      name: "default",
    },
  });

  assert.match(query.primary, /Current user message:\nEvening reflection\./);
  assert.match(query.continuity, /Recent user context:\nMorning wobble\./);
  assert.doesNotMatch(query.continuity, /Scheduled journal/);
});
