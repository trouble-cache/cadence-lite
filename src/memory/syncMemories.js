const { embedTexts } = require("./embeddings");
const { hasLlmApiKey } = require("../llm/client");
const {
  buildQdrantPoint,
  ensureCollection,
  upsertPoints,
} = require("./qdrantClient");

function chunkArray(items, size) {
  const chunks = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function canSyncMemories(config) {
  return Boolean(config?.qdrant?.url && hasLlmApiKey(config, "embedding"));
}

async function syncMemoriesToQdrant({ config, memories }) {
  const activeMemories = Array.isArray(memories)
    ? memories.filter((memory) => memory && memory.active)
    : [];

  if (!activeMemories.length || !canSyncMemories(config)) {
    return {
      syncedCount: 0,
      skipped: true,
    };
  }

  let syncedCount = 0;
  let collectionReady = false;

  for (const batch of chunkArray(activeMemories, 50)) {
    const vectors = await embedTexts({
      config,
      inputs: batch.map((memory) => memory.content),
    });

    if (!collectionReady) {
      await ensureCollection({
        config,
        vectorSize: vectors[0].length,
      });
      collectionReady = true;
    }

    await upsertPoints({
      config,
      points: batch.map((memory, index) => buildQdrantPoint(memory, vectors[index])),
    });

    syncedCount += batch.length;
  }

  return {
    syncedCount,
    skipped: false,
  };
}

async function syncMemoryToQdrant({ config, memory }) {
  if (!memory?.active) {
    return {
      syncedCount: 0,
      skipped: true,
    };
  }

  return syncMemoriesToQdrant({
    config,
    memories: [memory],
  });
}

module.exports = {
  canSyncMemories,
  syncMemoriesToQdrant,
  syncMemoryToQdrant,
};
