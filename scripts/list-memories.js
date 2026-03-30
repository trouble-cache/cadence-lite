const { loadConfig } = require("../src/config/env");
const { createLogger } = require("../src/utils/logger");
const { createMemoryStore } = require("../src/storage");

function parseArguments(argv) {
  const args = argv.slice(2);
  const options = {
    limit: 50,
    userScope: "",
    activeOnly: false,
  };

  for (const arg of args) {
    if (arg === "--active-only") {
      options.activeOnly = true;
      continue;
    }

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

function formatMemory(memory, index) {
  return [
    `${index + 1}. ${memory.title}`,
    `   memory_id: ${memory.memoryId}`,
    `   type: ${memory.memoryType} | domain: ${memory.domain} | sensitivity: ${memory.sensitivity} | importance: ${memory.importance}`,
    `   user_scope: ${memory.userScope} | active: ${memory.active}`,
    `   updated_at: ${memory.updatedAt} | last_used_at: ${memory.lastUsedAt || "-"} | use_count: ${memory.useCount ?? 0}`,
  ].join("\n");
}

async function main() {
  const options = parseArguments(process.argv);
  const config = loadConfig();
  const logger = createLogger(config.logLevel);

  if (!config.database.url) {
    console.error("DATABASE_URL is required to list memories.");
    process.exit(1);
  }

  const memoryStore = createMemoryStore({ config, logger });
  await memoryStore.init();

  const memories = await memoryStore.listMemories({
    limit: options.limit,
    userScope: options.userScope || config.memory.userScope,
    activeOnly: options.activeOnly,
  });

  if (!memories.length) {
    process.stdout.write("No memories found.\n");
    await memoryStore.close();
    return;
  }

  process.stdout.write(`${memories.map(formatMemory).join("\n\n")}\n`);

  await memoryStore.close();
}

main().catch((error) => {
  console.error("[memories:list] Failed to list memories", error);
  process.exit(1);
});
