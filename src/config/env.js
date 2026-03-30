require("dotenv").config();

function readBoolean(value, defaultValue = false) {
  if (value === undefined) {
    return defaultValue;
  }

  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function buildCapabilityConfig({
  fallbackModel,
  httpReferer = "",
  appTitle = "Cadence",
}) {
  const model = fallbackModel;

  return {
    provider: "openrouter",
    apiKey: process.env.OPENROUTER_API_KEY || "",
    baseURL: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
    httpReferer,
    appTitle,
    model,
  };
}

function loadConfig() {
  const llmChatModel = process.env.CHAT_LLM_MODEL || process.env.LLM_CHAT_MODEL || "openai/gpt-5.4";
  const llmImageModel = process.env.IMAGE_LLM_MODEL || process.env.LLM_IMAGE_MODEL || "openai/gpt-5.4-mini";
  const llmEmbeddingModel = process.env.EMBEDDING_LLM_MODEL || "openai/text-embedding-3-small";
  const llmTranscriptionModel = process.env.TRANSCRIPTION_LLM_MODEL || "google/gemini-2.5-flash";
  const llmHttpReferer = process.env.OPENROUTER_HTTP_REFERER || "";
  const llmAppTitle = process.env.OPENROUTER_APP_TITLE || "Cadence Lite";
  const openrouterApiKey = process.env.OPENROUTER_API_KEY || "";
  const openrouterBaseURL = process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";

  const llmChat = buildCapabilityConfig({
    fallbackModel: llmChatModel,
    httpReferer: llmHttpReferer,
    appTitle: llmAppTitle,
  });
  const llmImage = buildCapabilityConfig({
    fallbackModel: llmImageModel,
    httpReferer: llmHttpReferer,
    appTitle: llmAppTitle,
  });
  const llmEmbedding = buildCapabilityConfig({
    fallbackModel: llmEmbeddingModel,
    httpReferer: llmHttpReferer,
    appTitle: llmAppTitle,
  });
  const llmTranscription = buildCapabilityConfig({
    fallbackModel: llmTranscriptionModel,
    httpReferer: llmHttpReferer,
    appTitle: llmAppTitle,
  });

  return {
    port: Number(process.env.PORT) || 3000,
    nodeEnv: process.env.NODE_ENV || "development",
    logLevel: process.env.LOG_LEVEL || "info",
    discord: {
      token: process.env.DISCORD_TOKEN || "",
      clientId: process.env.DISCORD_CLIENT_ID || "",
      guildId: process.env.DISCORD_GUILD_ID || "",
      allowedChannelId: process.env.DISCORD_ALLOWED_CHANNEL_ID || "",
      respondToMentionsOnly: readBoolean(process.env.DISCORD_RESPOND_TO_MENTIONS_ONLY, false),
    },
    chat: {
      historyLimit: Math.max(0, Math.min(Number.parseInt(process.env.CHAT_HISTORY_LIMIT || "20", 10) || 20, 50)),
      includeTimeContext: readBoolean(process.env.CHAT_INCLUDE_TIME_CONTEXT, true),
      timezone: process.env.CHAT_TIMEZONE || "UTC",
      placeholderModel: llmChatModel,
      promptBlocks: {
        personaName: process.env.CHAT_PROMPT_PERSONA_NAME || "AI Name",
        userName: process.env.CHAT_PROMPT_USER_NAME || process.env.MEMORY_USER_SCOPE || "User Name",
        personaProfile: process.env.CHAT_PROMPT_PERSONA_PROFILE || "",
        toneGuidelines: process.env.CHAT_PROMPT_TONE_GUIDELINES || "",
        userProfile: process.env.CHAT_PROMPT_USER_PROFILE || "",
        companionPurpose: process.env.CHAT_PROMPT_COMPANION_PURPOSE || "",
        boundaryRules: process.env.CHAT_PROMPT_BOUNDARY_RULES || "",
      },
    },
    llm: {
      provider: "openrouter",
      apiKey: openrouterApiKey,
      baseURL: openrouterBaseURL,
      httpReferer: llmHttpReferer,
      appTitle: llmAppTitle,
      chatModel: llmChatModel,
      imageModel: llmImageModel,
      embeddingModel: llmEmbedding.model,
      transcriptionModel: llmTranscription.model,
      chat: llmChat,
      image: llmImage,
      embedding: llmEmbedding,
      transcription: llmTranscription,
    },
    database: {
      url: process.env.DATABASE_URL || "",
    },
    qdrant: {
      url: process.env.QDRANT_URL || "",
      apiKey: process.env.QDRANT_API_KEY || "",
      collection: process.env.QDRANT_COLLECTION || "cadence-memory",
    },
    memory: {
      userScope: process.env.MEMORY_USER_SCOPE || "user",
    },
    admin: {
      secret: process.env.ADMIN_SECRET || "",
    },
  };
}

module.exports = {
  loadConfig,
};
