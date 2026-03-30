function buildReply({ mode, input, recentHistory, memories, modelOutput }) {
  if (modelOutput?.text?.trim() && modelOutput.provider !== "placeholder") {
    return {
      content: modelOutput.text,
      suppressEmbeds: Boolean(modelOutput.webSearchUsed),
    };
  }

  return {
    content: [
    `Mode: ${mode.name}`,
    "Cadence received your message and passed it through the starter chat pipeline.",
    `Message: ${input.content}`,
    `Recent history items: ${recentHistory.length}`,
    `Memories found: ${memories.length}`,
    "No model provider is wired yet, so this is a placeholder response.",
    ].join("\n"),
    suppressEmbeds: false,
  };
}

module.exports = {
  buildReply,
};
