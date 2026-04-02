const test = require("node:test");
const assert = require("node:assert/strict");

const {
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
