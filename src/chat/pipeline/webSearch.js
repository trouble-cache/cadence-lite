const WEB_SEARCH_TRIGGER_PATTERN = /\b(latest|current|recent|tonight|this week|this month|news|weather|forecast|price|score|result|results|look up|lookup|search|find online|on the web|verify|fact check|fact-check|what's happening|what is happening|who is currently)\b/i;

function shouldUseWebSearch({ input, automation } = {}) {
  const candidates = [
    String(input?.content || "").trim(),
    String(automation?.label || "").trim(),
    String(automation?.prompt || "").trim(),
  ].filter(Boolean);

  if (!candidates.length) {
    return false;
  }

  return candidates.some((content) => WEB_SEARCH_TRIGGER_PATTERN.test(content));
}

function buildWebSearchRequestOptions() {
  return {
    plugins: [{ id: "web" }],
  };
}

function normalizeSource(source = {}) {
  const url = String(source.url || "").trim();

  if (!url) {
    return null;
  }

  return {
    title: String(source.title || source.name || "").trim(),
    url,
  };
}

function walkForSources(value, collector) {
  if (!value || typeof value !== "object") {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => walkForSources(item, collector));
    return;
  }

  const normalized = normalizeSource(value);

  if (normalized) {
    collector.push(normalized);
  }

  if (Array.isArray(value.sources)) {
    value.sources.forEach((source) => {
      const sourceItem = normalizeSource(source);
      if (sourceItem) {
        collector.push(sourceItem);
      }
    });
  }

  if (Array.isArray(value.annotations)) {
    value.annotations.forEach((annotation) => {
      const annotationItem = normalizeSource(annotation);
      if (annotationItem) {
        collector.push(annotationItem);
      }
    });
  }

  Object.values(value).forEach((entry) => walkForSources(entry, collector));
}

function extractWebSearchSources(response = {}) {
  const collected = [];
  walkForSources(response.output || [], collected);

  const deduped = new Map();

  for (const source of collected) {
    if (!deduped.has(source.url)) {
      deduped.set(source.url, source);
    }
  }

  return Array.from(deduped.values()).slice(0, 5);
}

module.exports = {
  shouldUseWebSearch,
  buildWebSearchRequestOptions,
  extractWebSearchSources,
};
