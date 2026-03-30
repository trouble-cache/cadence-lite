const { embedTexts } = require("../embeddings");
const { searchPoints } = require("../qdrantClient");

const MEMORY_TYPE_CAPS = Object.freeze({
  anchor: 2,
  canon: 3,
  resolved: 1,
});

const QUERY_LAYER_LIMITS = Object.freeze({
  primary: 14,
  continuity: 10,
});

const MEMORY_RETRIEVAL_LANES = Object.freeze({
  durable: ["anchor", "canon", "resolved"],
});

const QUERY_LANE_LIMITS = Object.freeze({
  durable: {
    primary: 10,
    continuity: 8,
  },
});

const QUERY_LAYER_WEIGHT_BONUS = Object.freeze({
  durable: {
    primary: 0.12,
    continuity: 0,
  },
});

const RETRIEVAL_PROFILES = Object.freeze({
  lite: [
    { lane: "durable", layer: "primary" },
    { lane: "durable", layer: "continuity" },
  ],
});

function summarizeMemoryHit(hit) {
  const payload = hit.payload || {};
  const summary = {
    memoryId: payload.memory_id,
    title: payload.title,
    memoryType: payload.memory_type,
    domain: payload.domain,
    importance: payload.importance,
    score: Number(hit.score || 0),
    layerBonus: Number(hit.layerBonus || 0),
    weightedScore: Number(hit.weightedScore || 0),
  };

  if (hit.retrievalLayer) {
    summary.retrievalLayer = hit.retrievalLayer;
  }

  if (hit.retrievalLane) {
    summary.retrievalLane = hit.retrievalLane;
  }

  if (typeof hit.decayPenalty === "number" && hit.decayPenalty > 0) {
    summary.decayPenalty = hit.decayPenalty;
  }

  if (payload.reference_date) {
    summary.referenceDate = payload.reference_date;
  }

  return summary;
}

function rerankMemoryHit(hit, options = {}) {
  return {
    ...hit,
    decayPenalty: 0,
    layerBonus: Number(options.layerBonus || 0),
    weightedScore: Number(hit.score || 0) + Number(options.layerBonus || 0),
  };
}

function normalizeQueryLayers(query) {
  if (typeof query === "string") {
    return {
      primary: query,
      continuity: "",
    };
  }

  return {
    primary: String(query?.primary || "").trim(),
    continuity: String(query?.continuity || "").trim(),
  };
}

async function searchMemoryLayer({
  config,
  query,
  layer,
  lane,
  userScope,
}) {
  if (!query) {
    return [];
  }

  const [vector] = await embedTexts({
    config,
    inputs: [query],
  });

  const hits = await searchPoints({
    config,
    vector,
    limit: QUERY_LANE_LIMITS[lane]?.[layer] || QUERY_LAYER_LIMITS[layer] || QUERY_LAYER_LIMITS.primary,
    filter: buildMemorySearchFilter({
      userScope,
      memoryTypes: MEMORY_RETRIEVAL_LANES[lane],
    }),
  });

  return hits
    .map((hit) => ({
      ...rerankMemoryHit(hit, {
        layerBonus: QUERY_LAYER_WEIGHT_BONUS[lane]?.[layer] || 0,
      }),
      retrievalLayer: layer,
      retrievalLane: lane,
    }))
    .filter(passesMinimumScore);
}

function mergeRankedHits(layerResults) {
  const mergedById = new Map();

  for (const hit of layerResults.flat()) {
    const memoryId = hit.payload?.memory_id;

    if (!memoryId) {
      continue;
    }

    const existing = mergedById.get(memoryId);

    if (!existing || Number(hit.weightedScore || 0) > Number(existing.weightedScore || 0)) {
      mergedById.set(memoryId, hit);
    }
  }

  return [...mergedById.values()].sort((left, right) => right.weightedScore - left.weightedScore);
}

function selectMemoriesByType(hits) {
  const counters = {
    anchor: 0,
    canon: 0,
    resolved: 0,
  };

  const selected = [];

  for (const hit of hits) {
    const payload = hit.payload || {};
    const memoryType = payload.memory_type;

    if (!MEMORY_TYPE_CAPS[memoryType]) {
      continue;
    }

    if (counters[memoryType] >= MEMORY_TYPE_CAPS[memoryType]) {
      continue;
    }

    counters[memoryType] += 1;
    selected.push({
      memoryId: payload.memory_id,
      title: payload.title,
      content: payload.content,
      memoryType,
      domain: payload.domain,
      sensitivity: payload.sensitivity,
      importance: payload.importance,
      referenceDate: payload.reference_date,
      score: Number(hit.score || 0),
      layerBonus: Number(hit.layerBonus || 0),
      decayPenalty: Number(hit.decayPenalty || 0),
      weightedScore: hit.weightedScore,
      retrievalLayer: hit.retrievalLayer || null,
      retrievalLane: hit.retrievalLane || null,
    });
  }

  return selected;
}

function passesMinimumScore(hit) {
  const payload = hit.payload || {};
  const memoryType = payload.memory_type;
  return Boolean(MEMORY_TYPE_CAPS[memoryType]);
}

function buildMemorySearchFilter({ userScope, memoryTypes = [] }) {
  const must = [
    {
      key: "active",
      match: {
        value: true,
      },
    },
    {
      key: "user_scope",
      match: {
        value: userScope,
      },
    },
  ];

  const normalizedMemoryTypes = Array.isArray(memoryTypes)
    ? memoryTypes.map((value) => String(value || "").trim()).filter(Boolean)
    : [];

  if (normalizedMemoryTypes.length) {
    must.push({
      key: "memory_type",
      match: {
        any: normalizedMemoryTypes,
      },
    });
  }

  return { must };
}

function getRetrievalPlan() {
  return RETRIEVAL_PROFILES.lite;
}

async function hydrateMemoriesFromStore({ memoryStore, memories, userScope }) {
  if (!memoryStore || !memories.length) {
    return memories;
  }

  const memoryRows = await memoryStore.getMemoriesByIds(
    memories.map((memory) => memory.memoryId),
    { userScope },
  );

  if (!memoryRows.length) {
    return memories;
  }

  const rowsById = new Map(memoryRows.map((row) => [row.memoryId, row]));

  return memories.map((memory) => {
    const row = rowsById.get(memory.memoryId);

    if (!row) {
      return memory;
    }

    return {
      ...memory,
      title: row.title,
      content: row.content,
      memoryType: row.memoryType,
      domain: row.domain,
      sensitivity: row.sensitivity,
      importance: row.importance,
      referenceDate: row.referenceDate,
      lastUsedAt: row.lastUsedAt,
      updatedAt: row.updatedAt,
      source: row.source,
      active: row.active,
    };
  });
}

async function markMemoriesUsed({ memoryStore, memories, userScope, usedAt = new Date().toISOString() }) {
  if (!memoryStore || !memories.length) {
    return 0;
  }

  return memoryStore.touchMemoriesByIds(
    memories.map((memory) => memory.memoryId),
    {
      userScope,
      usedAt,
    },
  );
}

function createQdrantMemoryProvider({ config, logger, memoryStore = null, retrievalProfile = "lite" }) {
  return {
    async retrieve({ query, mode }) {
      const queries = normalizeQueryLayers(query);

      if (!queries.primary && !queries.continuity) {
        return [];
      }

      const retrievalPlan = getRetrievalPlan(retrievalProfile, mode);
      const layerResults = await Promise.all(retrievalPlan.map(({ lane, layer }) => searchMemoryLayer({
          config,
          query: queries[layer],
          layer,
          lane,
          userScope: config.memory.userScope,
        })));

      const rankedHits = mergeRankedHits(layerResults);

      const selectedMemories = selectMemoriesByType(rankedHits);
      const memories = await hydrateMemoriesFromStore({
        memoryStore,
        memories: selectedMemories,
        userScope: config.memory.userScope,
      });

      await markMemoriesUsed({
        memoryStore,
        memories,
        userScope: config.memory.userScope,
      });

      logger.info("[memory] Retrieved Qdrant memories", {
        retrievalProfile,
        primaryQueryLength: queries.primary.length,
        continuityQueryLength: queries.continuity.length,
        candidateCount: rankedHits.length,
        selectedCount: memories.length,
        userScope: config.memory.userScope,
      });

      logger.debug("[memory] Qdrant memory candidates", {
        queryPreview: {
          primary: queries.primary.slice(0, 120),
          continuity: queries.continuity.slice(0, 120),
        },
        candidates: rankedHits.map(summarizeMemoryHit),
      });

      logger.debug("[memory] Qdrant memories selected for prompt", {
        selected: memories.map((memory) => {
          const summary = {
            memoryId: memory.memoryId,
            title: memory.title,
            memoryType: memory.memoryType,
            domain: memory.domain,
            score: memory.score,
            layerBonus: memory.layerBonus,
            decayPenalty: memory.decayPenalty,
            weightedScore: memory.weightedScore,
            retrievalLayer: memory.retrievalLayer,
            retrievalLane: memory.retrievalLane,
          };

          if (memory.referenceDate) {
            summary.referenceDate = memory.referenceDate;
          }

          return summary;
        }),
      });

      return memories;
    },
  };
}

module.exports = {
  MEMORY_TYPE_CAPS,
  normalizeQueryLayers,
  searchMemoryLayer,
  mergeRankedHits,
  summarizeMemoryHit,
  rerankMemoryHit,
  selectMemoriesByType,
  passesMinimumScore,
  buildMemorySearchFilter,
  getRetrievalPlan,
  hydrateMemoriesFromStore,
  markMemoriesUsed,
  createQdrantMemoryProvider,
};
