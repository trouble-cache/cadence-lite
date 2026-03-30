function normalizeBaseUrl(url) {
  return String(url || "").replace(/\/+$/, "");
}

function buildHeaders(apiKey) {
  const headers = {
    "Content-Type": "application/json",
  };

  if (apiKey) {
    headers["api-key"] = apiKey;
  }

  return headers;
}

async function qdrantRequest({ config, method, path, body, allow404 = false }) {
  const baseUrl = normalizeBaseUrl(config.qdrant.url);

  if (!baseUrl) {
    throw new Error("QDRANT_URL is required.");
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: buildHeaders(config.qdrant.apiKey),
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (allow404 && response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Qdrant request failed (${response.status} ${response.statusText}): ${text}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function getCollection({ config }) {
  return qdrantRequest({
    config,
    method: "GET",
    path: `/collections/${config.qdrant.collection}`,
    allow404: true,
  });
}

async function deleteCollection({ config }) {
  return qdrantRequest({
    config,
    method: "DELETE",
    path: `/collections/${config.qdrant.collection}`,
    allow404: true,
  });
}

async function ensureCollection({ config, vectorSize }) {
  const existingCollection = await getCollection({ config });

  if (existingCollection) {
    return existingCollection;
  }

  return qdrantRequest({
    config,
    method: "PUT",
    path: `/collections/${config.qdrant.collection}`,
    body: {
      vectors: {
        size: vectorSize,
        distance: "Cosine",
      },
    },
  });
}

function buildQdrantPoint(memory, vector) {
  return {
    id: memory.memoryId,
    vector,
    payload: {
      memory_id: memory.memoryId,
      title: memory.title,
      content: memory.content,
      memory_type: memory.memoryType,
      domain: memory.domain,
      sensitivity: memory.sensitivity,
      source: memory.source,
      active: memory.active,
      importance: memory.importance,
      user_scope: memory.userScope,
      reference_date: memory.referenceDate,
      created_at: memory.createdAt,
      updated_at: memory.updatedAt,
      last_used_at: memory.lastUsedAt,
    },
  };
}

async function upsertPoints({ config, points }) {
  return qdrantRequest({
    config,
    method: "PUT",
    path: `/collections/${config.qdrant.collection}/points?wait=true`,
    body: {
      points,
    },
  });
}

async function deletePoints({ config, ids }) {
  const pointIds = Array.isArray(ids)
    ? ids.map((id) => String(id || "").trim()).filter(Boolean)
    : [];

  if (!pointIds.length) {
    return null;
  }

  return qdrantRequest({
    config,
    method: "POST",
    path: `/collections/${config.qdrant.collection}/points/delete?wait=true`,
    body: {
      points: pointIds,
    },
  });
}

async function getPoints({ config, ids }) {
  const pointIds = Array.isArray(ids)
    ? ids.map((id) => String(id || "").trim()).filter(Boolean)
    : [];

  if (!pointIds.length) {
    return [];
  }

  const response = await qdrantRequest({
    config,
    method: "POST",
    path: `/collections/${config.qdrant.collection}/points`,
    body: {
      ids: pointIds,
      with_payload: true,
      with_vector: false,
    },
  });

  return response?.result || [];
}

async function scrollPoints({ config, limit = 20, offset = null, filter = null }) {
  const response = await qdrantRequest({
    config,
    method: "POST",
    path: `/collections/${config.qdrant.collection}/points/scroll`,
    body: {
      limit,
      with_payload: true,
      with_vector: false,
      offset: offset || undefined,
      filter: filter || undefined,
    },
  });

  return {
    points: response?.result?.points || [],
    nextOffset: response?.result?.next_page_offset || null,
  };
}

async function searchPoints({ config, vector, limit, filter }) {
  const response = await qdrantRequest({
    config,
    method: "POST",
    path: `/collections/${config.qdrant.collection}/points/search`,
    body: {
      vector,
      limit,
      with_payload: true,
      with_vector: false,
      filter,
    },
  });

  return response?.result || [];
}

module.exports = {
  normalizeBaseUrl,
  getCollection,
  deleteCollection,
  ensureCollection,
  buildQdrantPoint,
  upsertPoints,
  deletePoints,
  getPoints,
  scrollPoints,
  searchPoints,
};
