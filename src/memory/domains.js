const SUPPORTED_MEMORY_DOMAINS = Object.freeze([
  "dynamic",
  "general",
  "health",
  "identity",
  "leisure",
  "lore",
  "patterns",
  "people",
  "places",
  "preferences",
  "projects",
  "recent_events",
  "rituals",
  "routines",
  "stressors",
  "systems",
  "work",
]);

function normalizeDomainValue(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function isSupportedMemoryDomain(value) {
  return SUPPORTED_MEMORY_DOMAINS.includes(normalizeDomainValue(value));
}

function assertSupportedMemoryDomain(value) {
  const normalized = normalizeDomainValue(value);

  if (!SUPPORTED_MEMORY_DOMAINS.includes(normalized)) {
    throw new Error(
      `Unsupported category "${value}". Expected one of: ${SUPPORTED_MEMORY_DOMAINS.join(", ")}.`,
    );
  }

  return normalized;
}

module.exports = {
  SUPPORTED_MEMORY_DOMAINS,
  normalizeDomainValue,
  isSupportedMemoryDomain,
  assertSupportedMemoryDomain,
};
