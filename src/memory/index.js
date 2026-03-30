const { hasLlmApiKey, resolveLlmProviderConfig } = require("../llm/client");
const { createNoopMemoryProvider } = require("./providers/noopMemoryProvider");
const { createQdrantMemoryProvider } = require("./providers/qdrantMemoryProvider");

function createMemoryService({ config, logger, memoryStore = null }) {
  const retrievalProfile = "lite";
  const embeddingProviderConfig = resolveLlmProviderConfig(config, "embedding");
  const hasQdrantBackend = Boolean(config.qdrant.url && hasLlmApiKey(config, "embedding"));
  const provider = hasQdrantBackend
    ? createQdrantMemoryProvider({ config, logger, memoryStore, retrievalProfile })
    : createNoopMemoryProvider({ config, logger });

  logger.info("[memory] Memory service configured", {
    retrievalProfile,
    qdrantConfigured: Boolean(config.qdrant.url),
    embeddingProvider: embeddingProviderConfig.provider,
    embeddingApiKeyConfigured: Boolean(embeddingProviderConfig.apiKey),
    provider: hasQdrantBackend ? "qdrant" : "noop",
  });

  return {
    retrieve: (params) => provider.retrieve(params),
  };
}

module.exports = {
  createMemoryService,
};
