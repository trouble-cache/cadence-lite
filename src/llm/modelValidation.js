const { resolveLlmProviderConfig } = require("./client");

const MODEL_SETTING_DEFINITIONS = Object.freeze([
  {
    key: "llm.chat.model",
    label: "Chat",
    getCurrentValue: (config) => String(config.llm?.chat?.model || config.llm?.chatModel || "").trim(),
  },
  {
    key: "llm.image.model",
    label: "Images",
    getCurrentValue: (config) => String(config.llm?.image?.model || config.llm?.imageModel || "").trim(),
  },
  {
    key: "llm.embedding.model",
    label: "Embeddings",
    getCurrentValue: (config) => String(config.llm?.embedding?.model || config.llm?.embeddingModel || "").trim(),
  },
  {
    key: "llm.transcription.model",
    label: "Transcription",
    getCurrentValue: (config) => String(config.llm?.transcription?.model || config.llm?.transcriptionModel || "").trim(),
  },
]);

function buildModelsUserUrl(baseURL) {
  const normalizedBaseUrl = String(baseURL || "").trim() || "https://openrouter.ai/api/v1";
  const url = new URL(normalizedBaseUrl.endsWith("/") ? normalizedBaseUrl : `${normalizedBaseUrl}/`);
  url.pathname = `${url.pathname.replace(/\/$/, "")}/models/user`;
  url.search = "";
  return url.toString();
}

function splitSettingsByKeys(settings = {}, selectedKeys = []) {
  const selected = {};
  const remainder = {};
  const selectedKeySet = new Set(selectedKeys);

  for (const [key, value] of Object.entries(settings || {})) {
    if (selectedKeySet.has(key)) {
      selected[key] = value;
      continue;
    }

    remainder[key] = value;
  }

  return {
    selected,
    remainder,
  };
}

function getChangedModelSettings(config = {}, settings = {}) {
  return MODEL_SETTING_DEFINITIONS
    .filter((definition) => Object.prototype.hasOwnProperty.call(settings, definition.key))
    .map((definition) => {
      const nextValue = String(settings[definition.key] || "").trim();
      const currentValue = definition.getCurrentValue(config);

      return {
        key: definition.key,
        label: definition.label,
        currentValue,
        nextValue,
      };
    })
    .filter((entry) => entry.nextValue && entry.nextValue !== entry.currentValue);
}

function formatModelValidationError(invalidModels = []) {
  if (!invalidModels.length) {
    return "";
  }

  const details = invalidModels.map((entry) => `${entry.label}: ${entry.nextValue}`).join("; ");
  return `These model changes were not saved because OpenRouter says they are unavailable for this API key: ${details}. Check account privacy/provider filters or choose a different model.`;
}

async function fetchAvailableOpenRouterModelIds({
  config = {},
  capability = "chat",
  fetchImpl = globalThis.fetch,
}) {
  if (typeof fetchImpl !== "function") {
    throw new Error("Fetch is not available for OpenRouter model validation.");
  }

  const providerConfig = resolveLlmProviderConfig(config, capability);

  if (!providerConfig.apiKey) {
    throw new Error("OPENROUTER_API_KEY is missing.");
  }

  const response = await fetchImpl(buildModelsUserUrl(providerConfig.baseURL), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${providerConfig.apiKey}`,
      Accept: "application/json",
      ...providerConfig.defaultHeaders,
    },
  });

  let payload = null;

  try {
    payload = await response.json();
  } catch (_error) {
    payload = null;
  }

  if (!response.ok) {
    const responseMessage = String(payload?.error?.message || payload?.message || "").trim();
    throw new Error(
      responseMessage || `OpenRouter model validation failed with status ${response.status}.`,
    );
  }

  const models = Array.isArray(payload?.data) ? payload.data : [];
  const modelIds = new Set();

  for (const model of models) {
    const id = String(model?.id || "").trim();
    const canonicalSlug = String(model?.canonical_slug || "").trim();

    if (id) {
      modelIds.add(id);
    }

    if (canonicalSlug) {
      modelIds.add(canonicalSlug);
    }
  }

  return modelIds;
}

async function validateChangedModelSettings({
  config = {},
  settings = {},
  fetchImpl = globalThis.fetch,
  logger = null,
}) {
  const changedModels = getChangedModelSettings(config, settings);

  if (!changedModels.length) {
    return {
      checked: false,
      changedModels,
      invalidModels: [],
      reason: "no_model_changes",
      message: "",
    };
  }

  const providerConfig = resolveLlmProviderConfig(config, "chat");

  if (!providerConfig.apiKey) {
    return {
      checked: false,
      changedModels,
      invalidModels: [],
      reason: "missing_api_key",
      message: "Saved Lite settings. Model availability could not be checked because OPENROUTER_API_KEY is missing.",
    };
  }

  try {
    const availableModelIds = await fetchAvailableOpenRouterModelIds({
      config,
      capability: "chat",
      fetchImpl,
    });
    const invalidModels = changedModels.filter((entry) => !availableModelIds.has(entry.nextValue));

    return {
      checked: true,
      changedModels,
      invalidModels,
      reason: invalidModels.length ? "invalid_models" : "valid_models",
      message: "",
    };
  } catch (error) {
    logger?.warn?.("[admin] OpenRouter model validation lookup failed", {
      error: error.message,
      changedModels: changedModels.map((entry) => entry.nextValue),
    });

    return {
      checked: false,
      changedModels,
      invalidModels: [],
      reason: "validation_lookup_failed",
      message: `Saved Lite settings, but OpenRouter model availability could not be checked: ${error.message}`,
    };
  }
}

async function planSettingsSave({
  config = {},
  settings = {},
  fetchImpl = globalThis.fetch,
  logger = null,
}) {
  const modelSettingKeys = MODEL_SETTING_DEFINITIONS.map((definition) => definition.key);
  const { selected: modelSettings, remainder: nonModelSettings } = splitSettingsByKeys(settings, modelSettingKeys);
  const validation = await validateChangedModelSettings({
    config,
    settings: modelSettings,
    fetchImpl,
    logger,
  });

  let settingsToPersist = settings;
  let successMessage = "Saved Lite settings and applied them to the live config.";
  let errorMessage = "";

  if (validation.checked && validation.invalidModels.length) {
    settingsToPersist = nonModelSettings;
    successMessage = Object.keys(nonModelSettings).length
      ? "Saved Lite settings, but left invalid model changes unchanged."
      : "Model changes were not saved.";
    errorMessage = formatModelValidationError(validation.invalidModels);
  } else if (!validation.checked && validation.message) {
    successMessage = validation.message;
  }

  return {
    modelSettings,
    nonModelSettings,
    settingsToPersist,
    successMessage,
    errorMessage,
    validation,
  };
}

module.exports = {
  MODEL_SETTING_DEFINITIONS,
  buildModelsUserUrl,
  splitSettingsByKeys,
  getChangedModelSettings,
  formatModelValidationError,
  fetchAvailableOpenRouterModelIds,
  validateChangedModelSettings,
  planSettingsSave,
};
