const path = require("node:path");
const { loadConfig } = require("../src/config/env");
const { createLogger } = require("../src/utils/logger");
const { createMemoryStore } = require("../src/storage");
const { loadMemoryRecordsFromPath } = require("../src/memory/importNotes");

function parseArguments(argv) {
  const args = argv.slice(2);
  const options = {
    targetPath: "",
    userScope: "",
  };

  for (const arg of args) {
    if (arg.startsWith("--user-scope=")) {
      options.userScope = arg.slice("--user-scope=".length).trim();
      continue;
    }

    if (!options.targetPath) {
      options.targetPath = arg;
    }
  }

  return options;
}

async function main() {
  const options = parseArguments(process.argv);

  if (!options.targetPath) {
    console.error("Usage: node scripts/import-memories.js <path-to-memory-notes> [--user-scope=georgia]");
    process.exit(1);
  }

  const config = loadConfig();
  const logger = createLogger(config.logLevel);

  if (!config.database.url) {
    console.error("DATABASE_URL is required to import memories.");
    process.exit(1);
  }

  const targetPath = path.resolve(options.targetPath);
  const memoryStore = createMemoryStore({ config, logger });

  await memoryStore.init();

  const records = await loadMemoryRecordsFromPath(targetPath);

  let importedCount = 0;

  for (const record of records) {
    await memoryStore.upsertMemory(
      {
        memory_id: record.memoryId,
        title: record.title,
        content: record.content,
        memory_type: record.memoryType,
        domain: record.domain,
        sensitivity: record.sensitivity,
        source: record.source,
        active: record.active,
        importance: record.importance,
        created_at: record.createdAt,
        updated_at: record.updatedAt,
        last_used_at: record.lastUsedAt,
      },
      {
        source: "manual_import",
        userScope: options.userScope || config.memory.userScope,
      },
    );

    importedCount += 1;
  }

  process.stdout.write(`Imported ${importedCount} memories from ${targetPath}\n`);

  await memoryStore.close();
}

main().catch((error) => {
  console.error("[memories:import] Failed to import memories", error);
  process.exit(1);
});
