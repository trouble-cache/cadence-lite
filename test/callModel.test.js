const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildModelInput,
  formatMemories,
  formatTimestamp,
} = require("../src/chat/pipeline/callModel");

test("formatMemories only includes durable memories in lite", () => {
  const formatted = formatMemories([
    {
      memoryType: "canon",
      domain: "projects",
      title: "Cadence",
      content: "Cadence is an ongoing build.",
    },
    {
      memoryType: "resolved",
      domain: "patterns",
      title: "Steadier pacing",
      content: "Georgia does better with smaller, calmer build steps.",
    },
  ]);

  assert.match(formatted, /Memories:\n1\. \[canon\/projects\] Cadence: Cadence is an ongoing build\./);
  assert.match(formatted, /2\. \[resolved\/patterns\] Steadier pacing: Georgia does better with smaller, calmer build steps\./);
});

test("formatMemories renders empty sections when no memories are available", () => {
  const formatted = formatMemories([]);

  assert.equal(formatted, "Memories:\nNone");
});

test("formatTimestamp respects Europe/London daylight savings transitions", () => {
  const beforeSpringShift = formatTimestamp("2026-03-29T00:30:00.000Z", "Europe/London");
  const afterSpringShift = formatTimestamp("2026-03-29T01:30:00.000Z", "Europe/London");
  const beforeAutumnShift = formatTimestamp("2026-10-25T00:30:00.000Z", "Europe/London");
  const afterAutumnShift = formatTimestamp("2026-10-25T01:30:00.000Z", "Europe/London");

  assert.match(beforeSpringShift, /\(Sunday, 29 March 2026 at 00:30:00 GMT\)$/);
  assert.match(afterSpringShift, /\(Sunday, 29 March 2026 at 02:30:00 BST\)$/);
  assert.match(beforeAutumnShift, /\(Sunday, 25 October 2026 at 01:30:00 BST\)$/);
  assert.match(afterAutumnShift, /\(Sunday, 25 October 2026 at 01:30:00 GMT\)$/);
});

test("buildModelInput separates prior turns, background context, and final user message", () => {
  const input = buildModelInput({
    input: {
      content: "What should I do next?",
      authorName: "Georgia",
      inputTypes: ["text"],
      messageTimestamp: "2026-03-20T10:00:00.000Z",
    },
    recentHistory: [
      {
        role: "user",
        authorName: "Georgia",
        content: "I fixed the first bit.",
      },
      {
        role: "assistant",
        authorName: "Cadence",
        content: "Good. What's still misbehaving?",
      },
      {
        role: "system",
        authorName: "Cadence",
        eventType: "image_analysis",
        source: "cadence",
        content: "[image_analysis] A railway map on the desk.",
      },
    ],
    memories: [
      {
        memoryType: "canon",
        domain: "projects",
        title: "Cadence",
        content: "Cadence Lite is the current project.",
      },
    ],
    contextSections: [
      {
        label: "Extra context",
        content: "The user wants small iterative steps.",
      },
    ],
    totalToolCount: 1,
    includeTimeContext: false,
    configuredTimezone: "Europe/London",
    now: new Date("2026-03-20T10:05:00.000Z"),
    automation: null,
  });

  assert.equal(input.length, 5);
  assert.equal(input[0].role, "user");
  assert.equal(input[0].content[0].text, "Georgia: I fixed the first bit.");
  assert.equal(input[1].role, "assistant");
  assert.equal(input[1].content[0].text, "Cadence: Good. What's still misbehaving?");
  assert.equal(input[2].role, "system");
  assert.match(input[2].content[0].text, /Cadence \[image_analysis, cadence\]: \[image_analysis\] A railway map on the desk\./);
  assert.equal(input[3].role, "system");
  assert.match(input[3].content[0].text, /Relevant memories:\nMemories:/);
  assert.doesNotMatch(input[3].content[0].text, /Recent history:/);
  assert.equal(input[4].role, "user");
  assert.equal(input[4].content[0].text, "What should I do next?");
});
