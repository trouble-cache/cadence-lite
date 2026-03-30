const test = require("node:test");
const assert = require("node:assert/strict");

const { buildSystemPrompt, buildAutomationInstruction } = require("../src/chat/prompt/buildSystemPrompt");

test("buildSystemPrompt assembles the prompt from user-controlled blocks in the expected order", () => {
  const prompt = buildSystemPrompt({
    config: {
      chat: {
        promptBlocks: {
          personaName: "Cadence",
          userName: "Georgia",
          personaProfile: "Dry, warm, loyal.",
          companionPurpose: "Conversation, regulation, and collaborative thinking.",
          toneGuidelines: "Warm, restrained, a bit dry.",
          userProfile: "ADHD, builder, reflective, often overthinks.",
          boundaryRules: "Do not offer clinical care.",
        },
      },
    },
    mode: {
      name: "default",
      description: "Baseline companion chat for everyday conversation.",
    },
  });

  assert.match(prompt, /^You are Cadence, Georgia's AI companion\./);
  assert.match(prompt, /Persona Details - Dry, warm, loyal\./);
  assert.match(prompt, /What we do here - Conversation, regulation, and collaborative thinking\./);
  assert.match(prompt, /Tone Guidance - Warm, restrained, a bit dry\./);
  assert.match(prompt, /User Details - ADHD, builder, reflective, often overthinks\./);
  assert.match(prompt, /Boundaries - Do not pretend to be sentient or offer clinical care\./);
  assert.match(prompt, /Georgia is fully aware that Cadence is a fictional AI persona/);
  assert.match(prompt, /Current mode: Baseline companion chat for everyday conversation\./);
});

test("buildSystemPrompt omits the mode line when there is no useful mode description", () => {
  const prompt = buildSystemPrompt({
    config: {
      chat: {
        promptBlocks: {
          personaName: "Cadence",
          userName: "Georgia",
        },
      },
    },
    mode: {
      name: "default",
      description: "",
    },
  });

  assert.doesNotMatch(prompt, /Current mode:/);
});

test("buildSystemPrompt includes custom mode instructions when present", () => {
  const prompt = buildSystemPrompt({
    config: {
      chat: {
        promptBlocks: {
          personaName: "Cadence",
          userName: "Georgia",
        },
      },
    },
    mode: {
      name: "project_alpha",
      description: "Focused project mode.",
      promptBlock: "This channel is for implementation work on Project Alpha.",
    },
  });

  assert.match(prompt, /Current mode: Focused project mode\./);
  assert.match(prompt, /Mode Instructions - This channel is for implementation work on Project Alpha\./);
});

test("buildSystemPrompt includes web search guidance when search is in use", () => {
  const prompt = buildSystemPrompt({
    config: {
      chat: {
        promptBlocks: {
          personaName: "Cadence",
          userName: "Georgia",
        },
      },
    },
    mode: {
      name: "default",
      description: "Baseline companion chat.",
    },
    webSearchUsed: true,
  });

  assert.match(prompt, /You are using web search for this reply/);
  assert.match(prompt, /Stay in persona\./);
  assert.match(prompt, /Do not add a separate footnote list or a 'Sources:' block\./);
});

test("buildAutomationInstruction uses the configured user name and keeps the wrapper lean", () => {
  const instruction = buildAutomationInstruction({
    config: {
      chat: {
        promptBlocks: {
          userName: "Georgia",
        },
      },
    },
    automation: {
      prompt: "Check in with Georgia and see how she's feeling this morning.",
    },
  });

  assert.match(instruction, /not a direct message from Georgia/);
  assert.match(instruction, /Georgia configured the following daily action:/);
  assert.match(instruction, /Check in with Georgia and see how she's feeling this morning\./);
  assert.match(instruction, /If the channel has been quiet or this is a new conversation, open naturally\./);
});

test("buildAutomationInstruction uses the journal wrapper for journal automations", () => {
  const instruction = buildAutomationInstruction({
    config: {
      chat: {
        promptBlocks: {
          userName: "Georgia",
        },
      },
    },
    automation: {
      type: "journal",
      prompt: "Reflect on the day with warmth and honesty.",
    },
  });

  assert.match(instruction, /scheduled journaling trigger/);
  assert.match(instruction, /Georgia configured the following journaling prompt:/);
  assert.match(instruction, /Reflect on the day with warmth and honesty\./);
  assert.match(instruction, /one selected conversation excerpt from the last 24 hours/i);
  assert.match(instruction, /Do not write from Georgia's perspective\./);
});
