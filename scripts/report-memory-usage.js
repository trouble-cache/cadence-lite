const { loadConfig } = require("../src/config/env");
const { createLogger } = require("../src/utils/logger");
const { createMemoryStore } = require("../src/storage");

function parseArguments(argv) {
  const args = argv.slice(2);
  const options = {
    limit: 10,
    userScope: "",
    activeOnly: true,
  };

  for (const arg of args) {
    if (arg === "--all") {
      options.activeOnly = false;
      continue;
    }

    if (arg.startsWith("--user-scope=")) {
      options.userScope = arg.slice("--user-scope=".length).trim();
      continue;
    }

    if (arg.startsWith("--limit=")) {
      const limit = Number(arg.slice("--limit=".length).trim());
      if (Number.isFinite(limit) && limit > 0) {
        options.limit = limit;
      }
      continue;
    }
  }

  return options;
}

function formatDate(value) {
  return value ? String(value) : "-";
}

function formatMemory(memory, index) {
  return [
    `${index + 1}. ${memory.title}`,
    `   memory_id: ${memory.memoryId}`,
    `   type: ${memory.memoryType} | domain: ${memory.domain} | importance: ${memory.importance}`,
    `   use_count: ${memory.useCount ?? 0} | last_used_at: ${formatDate(memory.lastUsedAt)} | reference_date: ${formatDate(memory.referenceDate)}`,
  ].join("\n");
}

function byUseCountDescending(left, right) {
  return (right.useCount || 0) - (left.useCount || 0);
}

function byUpdatedAtDescending(left, right) {
  return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
}

async function main() {
  const options = parseArguments(process.argv);
  const config = loadConfig();
  const logger = createLogger(config.logLevel);

  if (!config.database.url) {
    console.error("DATABASE_URL is required to report memory usage.");
    process.exit(1);
  }

  const memoryStore = createMemoryStore({ config, logger });
  await memoryStore.init();

  const userScope = options.userScope || config.memory.userScope;
  const memories = await memoryStore.listMemories({
    limit: 1000,
    userScope,
    activeOnly: options.activeOnly,
  });

  if (!memories.length) {
    process.stdout.write("No memories found.\n");
    await memoryStore.close();
    return;
  }

  const topUsed = [...memories]
    .filter((memory) => (memory.useCount || 0) > 0)
    .sort(byUseCountDescending)
    .slice(0, options.limit);

  const neverUsed = [...memories]
    .filter((memory) => (memory.useCount || 0) === 0)
    .sort(byUpdatedAtDescending)
    .slice(0, options.limit);

  process.stdout.write(`Memory usage report for user_scope="${userScope}"\n\n`);

  process.stdout.write("Most used memories:\n");
  if (topUsed.length) {
    process.stdout.write(`${topUsed.map(formatMemory).join("\n\n")}\n\n`);
  } else {
    process.stdout.write("None yet.\n\n");
  }

  process.stdout.write("Never used memories:\n");
  if (neverUsed.length) {
    process.stdout.write(`${neverUsed.map(formatMemory).join("\n\n")}\n`);
  } else {
    process.stdout.write("None.\n");
  }

  await memoryStore.close();
}

main().catch((error) => {
  console.error("[memories:usage] Failed to report memory usage", error);
  process.exit(1);
});
