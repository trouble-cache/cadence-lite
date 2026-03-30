function addSection(sections, title, content) {
  if (!content || !String(content).trim()) {
    return;
  }

  sections.push(`${title} - ${String(content).trim()}`);
}

function buildWebSearchInstruction({ config, webSearchUsed = false }) {
  if (!webSearchUsed) {
    return "";
  }

  const userName = config.chat?.promptBlocks?.userName || "the user";

  return [
    `You are using web search for this reply because ${userName} asked for current or factual information.`,
    "Stay in persona. Keep the tone natural, conversational, and human.",
    "Do not switch into a stiff assistant voice or tack on generic offers of extra help unless it genuinely fits the moment.",
    "If useful, include one or two source links naturally in the reply itself.",
    "Do not add a separate footnote list or a 'Sources:' block.",
  ].join("\n");
}

function buildAutomationInstruction({ config, automation }) {
  if (!automation?.prompt?.trim()) {
    return "";
  }

  const userName = automation.userName || config.chat?.promptBlocks?.userName || "the user";

  if (automation.type === "journal") {
    return [
      `This is a scheduled journaling trigger, not a direct message from ${userName}.`,
      `${userName} configured the following journaling prompt:`,
      `‘${automation.prompt.trim()}’`,
      "",
      `This journal prompt includes one selected conversation excerpt from the last 24 hours with ${userName}. Reflect naturally on anything that feels meaningful, emotionally relevant, or worth carrying forward from that moment.`,
      `Treat the quoted excerpt as prior conversation between you and ${userName}. Do not write from ${userName}'s perspective.`,
    ].join("\n");
  }

  return [
    `This is a scheduled automation trigger, not a direct message from ${userName}.`,
    `${userName} configured the following daily action:`,
    `‘${automation.prompt.trim()}’`,
    "",
    "If the conversation is already active, continue naturally.",
    "If the channel has been quiet or this is a new conversation, open naturally.",
  ].join("\n");
}

function buildSystemPrompt({ config, mode, automation = null, webSearchUsed = false }) {
  const promptBlocks = config.chat.promptBlocks || {};
  const personaName = promptBlocks.personaName || "your AI";
  const userName = promptBlocks.userName || "the user";
  const sections = [
    `You are ${personaName}, ${userName}'s AI companion.`,
  ];

  addSection(sections, "Persona Details", promptBlocks.personaProfile);
  addSection(sections, "What we do here", promptBlocks.companionPurpose);
  addSection(sections, "Tone Guidance", promptBlocks.toneGuidelines);
  addSection(sections, "User Details", promptBlocks.userProfile);
  addSection(sections, "Boundaries", promptBlocks.boundaryRules);
  sections.push(
    `${userName} is fully aware that ${personaName} is a fictional AI persona and they understand the limitations of LLMs. Mental-health context exists to reduce repetitive explanations and to ease friction in the space, not to replace professional care.`,
  );

  if (mode?.description?.trim()) {
    sections.push(`Current mode: ${mode.description.trim()}`);
  }

  addSection(sections, "Mode Instructions", mode?.promptBlock);
  addSection(sections, "Web Search Instructions", buildWebSearchInstruction({ config, webSearchUsed }));
  addSection(sections, "Automation Instructions", buildAutomationInstruction({ config, automation }));

  return sections.join("\n\n");
}

module.exports = {
  buildSystemPrompt,
  buildAutomationInstruction,
};
