const test = require("node:test");
const assert = require("node:assert/strict");

const {
  formatMemories,
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
