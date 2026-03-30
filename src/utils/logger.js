const LEVELS = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function normalizeLevel(level) {
  return LEVELS[level] ? level : "info";
}

function shouldLog(currentLevel, targetLevel) {
  return LEVELS[targetLevel] >= LEVELS[currentLevel];
}

function formatMeta(meta) {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
    return "";
  }

  const entries = Object.entries(meta).filter(([, value]) => value !== undefined);

  if (!entries.length) {
    return "";
  }

  return entries.map(([key, value]) => `${key}=${JSON.stringify(value)}`).join(" ");
}

function createLogMethod(currentLevel, targetLevel, writer) {
  return (message, meta, ...rest) => {
    if (!shouldLog(currentLevel, targetLevel)) {
      return;
    }

    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${targetLevel}]`;
    const formattedMeta = formatMeta(meta);

    if (formattedMeta) {
      writer(prefix, message, formattedMeta, ...rest);
      return;
    }

    writer(prefix, message, ...(meta === undefined ? rest : [meta, ...rest]));
  };
}

function createLogger(level = "info") {
  const currentLevel = normalizeLevel(String(level).toLowerCase());

  return {
    debug: createLogMethod(currentLevel, "debug", console.log),
    info: createLogMethod(currentLevel, "info", console.log),
    warn: createLogMethod(currentLevel, "warn", console.warn),
    error: createLogMethod(currentLevel, "error", console.error),
  };
}

module.exports = {
  createLogger,
};
