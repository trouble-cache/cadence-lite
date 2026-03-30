const { loadConfig } = require("../src/config/env");
const { createLogger } = require("../src/utils/logger");
const { createMemoryStore } = require("../src/storage");
const { deleteMemoryEverywhere } = require("../src/memory/deleteMemories");

function parseArguments(argv) {
  const args = argv.slice(2);
  const options = {
    memoryIds: [],
    userScope: "",
  };

  for (const arg of args) {
    if (arg.startsWith("--user-scope=")) {
      options.userScope = arg.slice("--user-scope=".length).trim();
      continue;
    }

    const trimmed = String(arg || "").trim();

    if (trimmed) {
      options.memoryIds.push(trimmed);
    }
  }

  return options;
}

async function main() {
  const options = parseArguments(process.argv);
  const config = loadConfig();
  const logger = createLogger(config.logLevel);

  if (!options.memoryIds.length) {
    console.error("Usage: node scripts/delete-memory.js <memory-id> [more-memory-ids...] [--user-scope=georgia]");
    process.exit(1);
  }

  if (!config.database.url) {
    console.error("DATABASE_URL is required to delete memories.");
    process.exit(1);
  }

  const memoryStore = createMemoryStore({ config, logger });
  await memoryStore.init();

  let deletedCount = 0;

  for (const memoryId of options.memoryIds) {
    const result = await deleteMemoryEverywhere({
      config,
      memoryStore,
      memoryId,
      userScope: options.userScope || config.memory.userScope,
    });

    if (!result.deleted) {
      process.stdout.write(`Skipped ${memoryId}: ${result.reason}\n`);
      continue;
    }

    deletedCount += 1;
    process.stdout.write(`Deleted ${result.memory.memoryId} (${result.memory.title})\n`);
  }

  process.stdout.write(`Finished. Deleted ${deletedCount} memory item(s).\n`);

  await memoryStore.close();
}

main().catch((error) => {
  console.error("[memories:delete] Failed to delete memory", error);
  process.exit(1);
});
