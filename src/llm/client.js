const OpenAI = require("openai");

const clientCache = new Map();

function resolveCapabilityKey(capability = "chat") {
  const normalized = String(capability || "chat").trim().toLowerCase();

  if (["chat", "image", "embedding", "transcription"].includes(normalized)) {
    return normalized;
  }

  return "chat";
}

function resolveLlmProviderConfig(config = {}, capability = "chat") {
  const capabilityKey = resolveCapabilityKey(capability);
  const capabilityConfig = config.llm?.[capabilityKey] || {};
  const provider = "openrouter";
  const apiKey = String(process.env.OPENROUTER_API_KEY || config.llm?.apiKey || "").trim();
  const baseURL = String(
    process.env.OPENROUTER_BASE_URL || capabilityConfig.baseURL || config.llm?.baseURL || "https://openrouter.ai/api/v1",
  ).trim();
  const defaultHeaders = {};

  const referer = String(capabilityConfig.httpReferer || config.llm?.httpReferer || "").trim();
  const appTitle = String(capabilityConfig.appTitle || config.llm?.appTitle || "").trim();

  if (referer) {
    defaultHeaders["HTTP-Referer"] = referer;
  }

  if (appTitle) {
    defaultHeaders["X-Title"] = appTitle;
  }

  return {
    capability: capabilityKey,
    provider,
    apiKey,
    baseURL,
    defaultHeaders,
  };
}

function hasLlmApiKey(config = {}, capability = "chat") {
  return Boolean(resolveLlmProviderConfig(config, capability).apiKey);
}

function getLlmClient(config = {}, capability = "chat") {
  const providerConfig = resolveLlmProviderConfig(config, capability);

  if (!providerConfig.apiKey) {
    return null;
  }

  const cacheKey = JSON.stringify(providerConfig);

  if (!clientCache.has(cacheKey)) {
    clientCache.set(cacheKey, new OpenAI({
      apiKey: providerConfig.apiKey,
      baseURL: providerConfig.baseURL || undefined,
      defaultHeaders: Object.keys(providerConfig.defaultHeaders).length ? providerConfig.defaultHeaders : undefined,
    }));
  }

  return clientCache.get(cacheKey);
}

function resolveChatModel(config = {}) {
  return String(config.llm?.chat?.model || config.llm?.chatModel || "").trim();
}

function resolveImageModel(config = {}) {
  return String(config.llm?.image?.model || config.llm?.imageModel || resolveChatModel(config)).trim();
}

function resolveEmbeddingModel(config = {}) {
  return String(
    config.llm?.embedding?.model || config.llm?.embeddingModel || "",
  ).trim();
}

function resolveTranscriptionModel(config = {}) {
  return String(
    config.llm?.transcription?.model || config.llm?.transcriptionModel || "",
  ).trim();
}

module.exports = {
  resolveLlmProviderConfig,
  hasLlmApiKey,
  getLlmClient,
  resolveChatModel,
  resolveImageModel,
  resolveEmbeddingModel,
  resolveTranscriptionModel,
};
