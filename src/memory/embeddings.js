const { getLlmClient, hasLlmApiKey, resolveEmbeddingModel } = require("../llm/client");

async function embedTexts({ config, inputs, client: providedClient }) {
  if (!hasLlmApiKey(config, "embedding")) {
    throw new Error("An embedding-capable LLM API key is required for memory embeddings.");
  }

  if (!inputs.length) {
    return [];
  }

  const client = providedClient || getLlmClient(config, "embedding");
  const response = await client.embeddings.create({
    model: resolveEmbeddingModel(config),
    input: inputs,
  });

  if (!Array.isArray(response?.data)) {
    throw new Error("Embedding response did not include a data array.");
  }

  return response.data
    .sort((left, right) => left.index - right.index)
    .map((item) => item.embedding);
}

module.exports = {
  embedTexts,
};
