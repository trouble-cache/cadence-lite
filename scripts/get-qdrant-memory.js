const { loadConfig } = require("../src/config/env");
const { getPoints } = require("../src/memory/qdrantClient");

function parseArguments(argv) {
  const args = argv.slice(2).map((arg) => String(arg || "").trim()).filter(Boolean);

  return {
    ids: args,
  };
}

async function main() {
  const options = parseArguments(process.argv);
  const config = loadConfig();

  if (!options.ids.length) {
    console.error("Usage: node scripts/get-qdrant-memory.js <memoryId> [more-memory-ids...]");
    process.exit(1);
  }

  if (!config.qdrant.url) {
    console.error("QDRANT_URL is required to inspect Qdrant memories.");
    process.exit(1);
  }

  const points = await getPoints({
    config,
    ids: options.ids,
  });

  if (!points.length) {
    process.stdout.write("No matching Qdrant points found.\n");
    return;
  }

  process.stdout.write(`${JSON.stringify(points, null, 2)}\n`);
}

main().catch((error) => {
  console.error("[memories:qdrant:get] Failed to fetch Qdrant memory", error);
  process.exit(1);
});
