const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildQdrantPoint,
  getPoints,
  scrollPoints,
} = require("../src/memory/qdrantClient");
const {
  buildMemorySearchFilter,
  getRetrievalPlan,
  hydrateMemoriesFromStore,
  markMemoriesUsed,
  mergeRankedHits,
  normalizeQueryLayers,
  passesMinimumScore,
  rerankMemoryHit,
  summarizeMemoryHit,
  selectMemoriesByType,
} = require("../src/memory/providers/qdrantMemoryProvider");

test("buildQdrantPoint maps a memory row into a single-collection payload", () => {
  const point = buildQdrantPoint({
    memoryId: "1234",
    title: "Clooney-Like",
    content: "Cadence has been compared to George Clooney before.",
    memoryType: "anchor",
    domain: "lore",
    sensitivity: "low",
    source: "manual_import",
    active: true,
    importance: 5,
    userScope: "georgia",
    referenceDate: "2026-03-22",
    createdAt: "2026-03-21T10:00:00.000Z",
    updatedAt: "2026-03-21T10:00:00.000Z",
    lastUsedAt: null,
  }, [0.1, 0.2]);

  assert.deepEqual(point, {
    id: "1234",
    vector: [0.1, 0.2],
    payload: {
      memory_id: "1234",
      title: "Clooney-Like",
      content: "Cadence has been compared to George Clooney before.",
      memory_type: "anchor",
      domain: "lore",
      sensitivity: "low",
      source: "manual_import",
      active: true,
      importance: 5,
      user_scope: "georgia",
      reference_date: "2026-03-22",
      created_at: "2026-03-21T10:00:00.000Z",
      updated_at: "2026-03-21T10:00:00.000Z",
      last_used_at: null,
    },
  });
});

test("buildMemorySearchFilter scopes retrieval to active memories for one user", () => {
  assert.deepEqual(buildMemorySearchFilter({ userScope: "georgia" }), {
    must: [
      {
        key: "active",
        match: {
          value: true,
        },
      },
      {
        key: "user_scope",
        match: {
          value: "georgia",
        },
      },
    ],
  });
});

test("buildMemorySearchFilter can constrain retrieval to a memory lane", () => {
  assert.deepEqual(buildMemorySearchFilter({
    userScope: "georgia",
    memoryTypes: ["anchor", "canon", "resolved"],
  }), {
    must: [
      {
        key: "active",
        match: {
          value: true,
        },
      },
      {
        key: "user_scope",
        match: {
          value: "georgia",
        },
      },
      {
        key: "memory_type",
        match: {
          any: ["anchor", "canon", "resolved"],
        },
      },
    ],
  });
});

test("getRetrievalPlan stays durable-only in lite", () => {
  assert.deepEqual(getRetrievalPlan("lite"), [
    { lane: "durable", layer: "primary" },
    { lane: "durable", layer: "continuity" },
  ]);
  assert.deepEqual(getRetrievalPlan("core"), [
    { lane: "durable", layer: "primary" },
    { lane: "durable", layer: "continuity" },
  ]);
});

test("selectMemoriesByType respects caps after weighted reranking", () => {
  const hits = [
    {
      score: 0.91,
      payload: {
        memory_id: "a1",
        title: "Anchor 1",
        content: "Anchor memory 1",
        memory_type: "anchor",
        domain: "lore",
        sensitivity: "low",
        importance: 5,
      },
    },
    {
      score: 0.89,
      payload: {
        memory_id: "a2",
        title: "Anchor 2",
        content: "Anchor memory 2",
        memory_type: "anchor",
        domain: "lore",
        sensitivity: "low",
        importance: 5,
      },
    },
    {
      score: 0.88,
      payload: {
        memory_id: "a3",
        title: "Anchor 3",
        content: "Anchor memory 3",
        memory_type: "anchor",
        domain: "lore",
        sensitivity: "low",
        importance: 5,
      },
    },
    {
      score: 0.88,
      payload: {
        memory_id: "c1",
        title: "Canon 1",
        content: "Canon memory 1",
        memory_type: "canon",
        domain: "patterns",
        sensitivity: "low",
        importance: 4,
      },
    },
    {
      score: 0.82,
      payload: {
        memory_id: "r1",
        title: "Resolved 1",
        content: "Resolved memory 1",
        memory_type: "resolved",
        domain: "stressors",
        sensitivity: "medium",
        importance: 3,
      },
    },
  ];

  const selected = selectMemoriesByType(
    hits
      .map(rerankMemoryHit)
      .sort((left, right) => right.weightedScore - left.weightedScore),
  );

  assert.deepEqual(selected.map((memory) => memory.memoryId), [
    "a1",
    "a2",
    "c1",
    "r1",
  ]);
});

test("passesMinimumScore allows supported durable memory types regardless of score", () => {
  assert.equal(passesMinimumScore({
    score: 0.01,
    payload: { memory_type: "canon" },
  }), true);

  assert.equal(passesMinimumScore({
    score: 0,
    payload: { memory_type: "resolved" },
  }), true);

  assert.equal(passesMinimumScore({
    score: 0.02,
    payload: { memory_type: "anchor" },
  }), true);
});

test("passesMinimumScore rejects unsupported temporal and roleplay memory types", () => {
  assert.equal(passesMinimumScore({
    score: 0.49,
    payload: {
      memory_type: "timeline_weekly",
    },
  }), false);

  assert.equal(passesMinimumScore({
    score: 0.43,
    payload: {
      memory_type: "timeline_daily",
    },
  }), false);

  assert.equal(passesMinimumScore({
    score: 0.53,
    payload: {
      memory_type: "roleplay",
    },
  }), false);
});

test("rerankMemoryHit applies layer bonuses without temporal decay", () => {
  const reranked = rerankMemoryHit({
    score: 0.4,
    payload: {
      memory_type: "canon",
      importance: 4,
    },
  }, {
    layerBonus: 0.12,
  });

  assert.equal(reranked.decayPenalty, 0);
  assert.equal(reranked.weightedScore, 0.52);
});

test("rerankMemoryHit leaves evergreen memory types unchanged", () => {
  const reranked = rerankMemoryHit({
    score: 0.4,
    payload: {
      memory_type: "canon",
      importance: 4,
    },
  });

  assert.equal(reranked.decayPenalty, 0);
  assert.equal(reranked.weightedScore, 0.4);
});

test("summarizeMemoryHit keeps retrieval debugging readable", () => {
  const summary = summarizeMemoryHit({
    score: 0.91,
    layerBonus: 0.12,
    weightedScore: 1.16,
    decayPenalty: 0.02,
    retrievalLayer: "primary",
    payload: {
      memory_id: "a1",
      title: "Anchor 1",
      memory_type: "anchor",
      domain: "lore",
      importance: 5,
    },
  });

  assert.deepEqual(summary, {
    title: "Anchor 1",
    type: "anchor",
    domain: "lore",
    weightedScore: 1.16,
  });
});

test("normalizeQueryLayers accepts legacy string or layered query objects", () => {
  assert.deepEqual(normalizeQueryLayers("just one query"), {
    primary: "just one query",
    continuity: "",
  });

  assert.deepEqual(normalizeQueryLayers({
    primary: "current message only",
    continuity: "current plus warm thread",
  }), {
    primary: "current message only",
    continuity: "current plus warm thread",
  });
});

test("mergeRankedHits keeps the best-scoring copy of each memory across retrieval layers", () => {
  const merged = mergeRankedHits([
    [
      {
        weightedScore: 0.46,
        retrievalLayer: "primary",
        payload: {
          memory_id: "abc-123",
          memory_type: "canon",
        },
      },
      {
        weightedScore: 0.39,
        retrievalLayer: "primary",
        payload: {
          memory_id: "def-456",
          memory_type: "anchor",
        },
      },
    ],
    [
      {
        weightedScore: 0.43,
        retrievalLayer: "continuity",
        payload: {
          memory_id: "abc-123",
          memory_type: "canon",
        },
      },
      {
        weightedScore: 0.41,
        retrievalLayer: "continuity",
        payload: {
          memory_id: "ghi-789",
          memory_type: "resolved",
        },
      },
    ],
  ]);

  assert.deepEqual(merged.map((hit) => [hit.payload.memory_id, hit.retrievalLayer, hit.weightedScore]), [
    ["abc-123", "primary", 0.46],
    ["ghi-789", "continuity", 0.41],
    ["def-456", "primary", 0.39],
  ]);
});

test("hydrateMemoriesFromStore prefers fresh Postgres content over stale Qdrant payloads", async () => {
  const hydrated = await hydrateMemoriesFromStore({
    memoryStore: {
      async getMemoriesByIds(ids) {
        assert.deepEqual(ids, ["abc-123"]);
        return [
          {
            memoryId: "abc-123",
            title: "Fresh title",
            content: "Fresh Postgres content",
            memoryType: "canon",
            domain: "projects",
            sensitivity: "low",
            importance: 4,
            referenceDate: "2026-03-24",
            lastUsedAt: null,
            updatedAt: "2026-03-24T10:00:00.000Z",
            source: "manual_import",
            active: true,
          },
        ];
      },
    },
    memories: [
      {
        memoryId: "abc-123",
        title: "Stale title",
        content: "Old Qdrant content",
        memoryType: "canon",
        domain: "general",
        sensitivity: "low",
        importance: 4,
        referenceDate: null,
        score: 0.5,
        weightedScore: 0.5,
      },
    ],
    userScope: "georgia",
  });

  assert.equal(hydrated[0].title, "Fresh title");
  assert.equal(hydrated[0].content, "Fresh Postgres content");
  assert.equal(hydrated[0].domain, "projects");
  assert.equal(hydrated[0].referenceDate, "2026-03-24");
  assert.equal(hydrated[0].score, 0.5);
});

test("markMemoriesUsed touches selected memory IDs in Postgres", async () => {
  let receivedIds = null;
  let receivedUserScope = null;
  let receivedUsedAt = null;

  const touched = await markMemoriesUsed({
    memoryStore: {
      async touchMemoriesByIds(ids, { userScope, usedAt }) {
        receivedIds = ids;
        receivedUserScope = userScope;
        receivedUsedAt = usedAt;
        return 2;
      },
    },
    memories: [
      { memoryId: "abc-123" },
      { memoryId: "def-456" },
    ],
    userScope: "georgia",
    usedAt: "2026-03-24T12:00:00.000Z",
  });

  assert.equal(touched, 2);
  assert.deepEqual(receivedIds, ["abc-123", "def-456"]);
  assert.equal(receivedUserScope, "georgia");
  assert.equal(receivedUsedAt, "2026-03-24T12:00:00.000Z");
});

test("markMemoriesUsed skips work when nothing was selected", async () => {
  const touched = await markMemoriesUsed({
    memoryStore: {
      async touchMemoriesByIds() {
        throw new Error("Should not be called for empty memory lists.");
      },
    },
    memories: [],
    userScope: "georgia",
  });

  assert.equal(touched, 0);
});

test("getPoints fetches specific point payloads from Qdrant", async () => {
  const originalFetch = global.fetch;

  global.fetch = async () => ({
    ok: true,
    status: 200,
    async json() {
      return {
        result: [
          {
            id: "abc-123",
            payload: {
              memory_id: "abc-123",
              title: "A stored memory",
            },
          },
        ],
      };
    },
  });

  try {
    const points = await getPoints({
      config: {
        qdrant: {
          url: "http://qdrant.test",
          apiKey: "",
          collection: "memories",
        },
      },
      ids: ["abc-123"],
    });

    assert.equal(points.length, 1);
    assert.equal(points[0].payload.memory_id, "abc-123");
  } finally {
    global.fetch = originalFetch;
  }
});

test("scrollPoints returns points and the next offset", async () => {
  const originalFetch = global.fetch;

  global.fetch = async () => ({
    ok: true,
    status: 200,
    async json() {
      return {
        result: {
          points: [
            {
              id: "abc-123",
              payload: {
                memory_id: "abc-123",
              },
            },
          ],
          next_page_offset: "next-1",
        },
      };
    },
  });

  try {
    const result = await scrollPoints({
      config: {
        qdrant: {
          url: "http://qdrant.test",
          apiKey: "",
          collection: "memories",
        },
      },
      limit: 10,
    });

    assert.equal(result.points.length, 1);
    assert.equal(result.nextOffset, "next-1");
  } finally {
    global.fetch = originalFetch;
  }
});
