const EDITABLE_RUNTIME_SETTINGS = Object.freeze([
  {
    key: "llm.chat.model",
    path: ["llm", "chat", "model"],
    normalize: (value) => String(value || "").trim(),
  },
  {
    key: "llm.image.model",
    path: ["llm", "image", "model"],
    normalize: (value) => String(value || "").trim(),
  },
  {
    key: "llm.embedding.model",
    path: ["llm", "embedding", "model"],
    normalize: (value) => String(value || "").trim(),
  },
  {
    key: "llm.transcription.model",
    path: ["llm", "transcription", "model"],
    normalize: (value) => String(value || "").trim(),
  },
  {
    key: "chat.historyLimit",
    path: ["chat", "historyLimit"],
    normalize: (value) => {
      const parsed = Number.parseInt(String(value || "").trim(), 10);

      if (!Number.isFinite(parsed)) {
        return 20;
      }

      return Math.max(0, Math.min(parsed, 50));
    },
  },
  {
    key: "chat.timezone",
    path: ["chat", "timezone"],
    normalize: (value) => {
      const normalized = String(value || "").trim();

      if (!normalized) {
        return "UTC";
      }

      if (["utc", "gmt"].includes(normalized.toLowerCase())) {
        return "UTC";
      }

      try {
        return new Intl.DateTimeFormat("en-US", { timeZone: normalized }).resolvedOptions().timeZone || normalized;
      } catch (_error) {
        const offsetMatch = normalized.match(/^(?:UTC|GMT)\s*([+-])\s*(\d{1,2})(?::?([0-5]\d))?$/i);

        if (offsetMatch) {
          const [, sign, hourText, minuteText = "00"] = offsetMatch;
          const hours = Number.parseInt(hourText, 10);
          const minutes = Number.parseInt(minuteText, 10);

          if (hours > 14 || minutes > 59) {
            throw new Error(`Invalid timezone "${value}". Use an IANA timezone like Europe/London or a UTC/GMT offset like GMT+1.`);
          }

          if (minutes !== 0) {
            throw new Error(`Invalid timezone "${value}". Cadence Lite currently supports IANA timezones or whole-hour UTC/GMT offsets like GMT+1.`);
          }

          if (hours === 0) {
            return "UTC";
          }

          return `Etc/GMT${sign === "+" ? "-" : "+"}${hours}`;
        }

        throw new Error(`Invalid timezone "${value}". Use an IANA timezone like Europe/London or a UTC/GMT offset like GMT+1.`);
      }
    },
  },
  {
    key: "chat.includeTimeContext",
    path: ["chat", "includeTimeContext"],
    normalize: (value) => Boolean(value),
  },
  {
    key: "chat.promptBlocks.personaName",
    path: ["chat", "promptBlocks", "personaName"],
    normalize: (value) => String(value || "").trim(),
  },
  {
    key: "chat.promptBlocks.userName",
    path: ["chat", "promptBlocks", "userName"],
    normalize: (value) => String(value || "").trim(),
  },
  {
    key: "chat.promptBlocks.personaProfile",
    path: ["chat", "promptBlocks", "personaProfile"],
    normalize: (value) => String(value || "").trim(),
  },
  {
    key: "chat.promptBlocks.toneGuidelines",
    path: ["chat", "promptBlocks", "toneGuidelines"],
    normalize: (value) => String(value || "").trim(),
  },
  {
    key: "chat.promptBlocks.userProfile",
    path: ["chat", "promptBlocks", "userProfile"],
    normalize: (value) => String(value || "").trim(),
  },
  {
    key: "chat.promptBlocks.companionPurpose",
    path: ["chat", "promptBlocks", "companionPurpose"],
    normalize: (value) => String(value || "").trim(),
  },
  {
    key: "chat.promptBlocks.boundaryRules",
    path: ["chat", "promptBlocks", "boundaryRules"],
    normalize: (value) => String(value || "").trim(),
  },
]);

function setNestedValue(target, path, value) {
  let current = target;

  for (let index = 0; index < path.length - 1; index += 1) {
    const key = path[index];

    if (!current[key] || typeof current[key] !== "object") {
      current[key] = {};
    }

    current = current[key];
  }

  current[path[path.length - 1]] = value;
}

function getNestedValue(target, path) {
  let current = target;

  for (const key of path) {
    if (!current || typeof current !== "object") {
      return "";
    }

    current = current[key];
  }

  return current ?? "";
}

function normalizeRuntimeSettings(input = {}) {
  const normalized = {};

  for (const setting of EDITABLE_RUNTIME_SETTINGS) {
    if (!Object.prototype.hasOwnProperty.call(input, setting.key)) {
      continue;
    }

    normalized[setting.key] = setting.normalize(input[setting.key]);
  }

  return normalized;
}

function applyRuntimeSettings(config, settings = {}) {
  const normalized = normalizeRuntimeSettings(settings);

  for (const setting of EDITABLE_RUNTIME_SETTINGS) {
    if (!Object.prototype.hasOwnProperty.call(normalized, setting.key)) {
      continue;
    }

    setNestedValue(config, setting.path, normalized[setting.key]);
  }

  if (Object.prototype.hasOwnProperty.call(normalized, "llm.chat.model")) {
    config.chat.placeholderModel = normalized["llm.chat.model"] || config.chat.placeholderModel;
    config.llm.chatModel = normalized["llm.chat.model"] || config.llm.chatModel;

    if (config.llm && typeof config.llm === "object") {
      config.llm.chat.model = normalized["llm.chat.model"] || config.llm.chat.model;
    }
  }

  if (Object.prototype.hasOwnProperty.call(normalized, "llm.image.model")) {
    config.llm.imageModel = normalized["llm.image.model"] || config.llm.imageModel;
  }

  if (Object.prototype.hasOwnProperty.call(normalized, "llm.embedding.model")) {
    config.llm.embeddingModel = normalized["llm.embedding.model"] || config.llm.embeddingModel;
  }

  if (Object.prototype.hasOwnProperty.call(normalized, "llm.transcription.model")) {
    config.llm.transcriptionModel = normalized["llm.transcription.model"] || config.llm.transcriptionModel;
  }

  return config;
}

function extractRuntimeSettings(config) {
  const result = {};

  for (const setting of EDITABLE_RUNTIME_SETTINGS) {
    result[setting.key] = getNestedValue(config, setting.path);
  }

  return result;
}

module.exports = {
  EDITABLE_RUNTIME_SETTINGS,
  normalizeRuntimeSettings,
  applyRuntimeSettings,
  extractRuntimeSettings,
};
