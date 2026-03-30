const { loadConfig } = require("../src/config/env");
const { createLogger } = require("../src/utils/logger");
const { createPostgresPool } = require("../src/storage/postgres/createPostgresPool");
const { deleteCollection, getCollection } = require("../src/memory/qdrantClient");

function parseArguments(argv) {
  const args = argv.slice(2);

  return {
    yes: args.includes("--yes"),
  };
}

async function main() {
  const options = parseArguments(process.argv);
  const config = loadConfig();
  const logger = createLogger(config.logLevel);

  if (!options.yes) {
    console.error("Refusing to reset memory storage without --yes.");
    console.error("Usage: node scripts/reset-memory-store.js --yes");
    process.exit(1);
  }

  if (!config.database.url) {
    console.error("DATABASE_URL is required to reset memory storage.");
    process.exit(1);
  }

  const pool = createPostgresPool({ config });

  if (!pool) {
    console.error("Could not create a Postgres pool for reset.");
    process.exit(1);
  }

  await pool.query("TRUNCATE TABLE staged_memories RESTART IDENTITY;");
  await pool.query("TRUNCATE TABLE memories RESTART IDENTITY;");

  let qdrantMessage = "Skipped Qdrant reset because QDRANT_URL is not configured.";

  if (config.qdrant.url) {
    const existingCollection = await getCollection({ config });

    if (existingCollection) {
      await deleteCollection({ config });
      qdrantMessage = `Deleted Qdrant collection ${config.qdrant.collection}.`;
    } else {
      qdrantMessage = `Qdrant collection ${config.qdrant.collection} did not exist.`;
    }
  }

  await pool.end();

  logger.info("[memory] Reset memory storage completed", {
    qdrantConfigured: Boolean(config.qdrant.url),
    collection: config.qdrant.collection,
  });

  process.stdout.write("Reset complete.\n");
  process.stdout.write("- Cleared Postgres staged_memories\n");
  process.stdout.write("- Cleared Postgres memories\n");
  process.stdout.write(`- ${qdrantMessage}\n`);
  process.stdout.write("Conversation history was left untouched.\n");
}

main().catch((error) => {
  console.error("[memories:reset] Failed to reset memory storage", error);
  process.exit(1);
});
