const { loadConfig } = require("../src/config/env");
const { scrollPoints } = require("../src/memory/qdrantClient");

function parseArguments(argv) {
  const args = argv.slice(2);
  const options = {
    limit: 20,
    offset: "",
  };

  for (const arg of args) {
    if (arg.startsWith("--offset=")) {
      options.offset = arg.slice("--offset=".length).trim();
      continue;
    }

    const limit = Number(arg);
    if (Number.isFinite(limit) && limit > 0) {
      options.limit = limit;
    }
  }

  return options;
}

function formatPoint(point, index) {
  const payload = point.payload || {};

  return [
    `${index + 1}. ${payload.title || point.id}`,
    `   point_id: ${point.id}`,
    `   memory_id: ${payload.memory_id || ""}`,
    `   type: ${payload.memory_type || ""} | domain: ${payload.domain || ""} | sensitivity: ${payload.sensitivity || ""} | importance: ${payload.importance ?? ""}`,
    `   reference_date: ${payload.reference_date || "none"} | active: ${payload.active}`,
    `   updated_at: ${payload.updated_at || "unknown"}`,
  ].join("\n");
}

async function main() {
  const options = parseArguments(process.argv);
  const config = loadConfig();

  if (!config.qdrant.url) {
    console.error("QDRANT_URL is required to list Qdrant memories.");
    process.exit(1);
  }

  const result = await scrollPoints({
    config,
    limit: options.limit,
    offset: options.offset || null,
  });

  if (!result.points.length) {
    process.stdout.write("No Qdrant points found.\n");
    return;
  }

  process.stdout.write(`${result.points.map(formatPoint).join("\n\n")}\n`);

  if (result.nextOffset) {
    process.stdout.write(`\nNext offset: ${result.nextOffset}\n`);
  }
}

main().catch((error) => {
  console.error("[memories:qdrant:list] Failed to list Qdrant memories", error);
  process.exit(1);
});
