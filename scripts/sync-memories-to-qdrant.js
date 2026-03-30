const { loadConfig } = require("../src/config/env");
const { createLogger } = require("../src/utils/logger");
const { createMemoryStore } = require("../src/storage");
const { embedTexts } = require("../src/memory/embeddings");
const { hasLlmApiKey } = require("../src/llm/client");
const {
  buildQdrantPoint,
  ensureCollection,
  upsertPoints,
} = require("../src/memory/qdrantClient");

function parseArguments(argv) {
  const args = argv.slice(2);
  const options = {
    limit: 500,
    userScope: "",
  };

  for (const arg of args) {
    if (arg.startsWith("--user-scope=")) {
      options.userScope = arg.slice("--user-scope=".length).trim();
      continue;
    }

    const limit = Number(arg);
    if (Number.isFinite(limit) && limit > 0) {
      options.limit = limit;
    }
  }

  return options;
}

function chunkArray(items, size) {
  const chunks = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

async function main() {
  const options = parseArguments(process.argv);
  const config = loadConfig();
  const logger = createLogger(config.logLevel);

  if (!config.database.url) {
    console.error("DATABASE_URL is required to sync memories.");
    process.exit(1);
  }

  if (!config.qdrant.url) {
    console.error("QDRANT_URL is required to sync memories.");
    process.exit(1);
  }

  if (!hasLlmApiKey(config, "embedding")) {
    console.error("A configured embedding-capable LLM API key is required to sync memories.");
    process.exit(1);
  }

  const memoryStore = createMemoryStore({ config, logger });
  await memoryStore.init();

  const memories = await memoryStore.listMemories({
    limit: options.limit,
    userScope: options.userScope || config.memory.userScope,
    activeOnly: true,
  });

  if (!memories.length) {
    process.stdout.write("No active memories found to sync.\n");
    await memoryStore.close();
    return;
  }

  let syncedCount = 0;
  let collectionReady = false;

  for (const batch of chunkArray(memories, 50)) {
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

  process.stdout.write(`Synced ${syncedCount} memories to Qdrant collection ${config.qdrant.collection}\n`);

  await memoryStore.close();
}

main().catch((error) => {
  console.error("[memories:sync] Failed to sync memories to Qdrant", error);
  process.exit(1);
});
