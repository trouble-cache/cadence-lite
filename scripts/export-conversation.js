const { loadConfig } = require("../src/config/env");
const { createLogger } = require("../src/utils/logger");
const { createConversationStore } = require("../src/storage");

function parseArguments(argv) {
  const args = argv.slice(2);
  const options = {
    conversationId: "",
    limit: 500,
    includeHeader: true,
    includeSystem: true,
    includeSummaries: true,
  };

  for (const arg of args) {
    if (arg === "--no-header") {
      options.includeHeader = false;
      continue;
    }

    if (arg === "--messages-only") {
      options.includeSystem = false;
      options.includeSummaries = false;
      continue;
    }

    if (arg === "--no-summaries") {
      options.includeSummaries = false;
      continue;
    }

    if (arg.startsWith("--limit=")) {
      const limit = Number(arg.slice("--limit=".length));
      if (Number.isFinite(limit) && limit > 0) {
        options.limit = limit;
      }
      continue;
    }

    if (!options.conversationId) {
      options.conversationId = arg;
      continue;
    }

    const positionalLimit = Number(arg);
    if (Number.isFinite(positionalLimit) && positionalLimit > 0) {
      options.limit = positionalLimit;
    }
  }

  return options;
}

async function main() {
  const {
    conversationId,
    limit,
    includeHeader,
    includeSystem,
    includeSummaries,
  } = parseArguments(process.argv);

  if (!conversationId) {
    console.error("Usage: node scripts/export-conversation.js <conversationId> [limit] [--no-header] [--no-summaries] [--messages-only] [--limit=500]");
    process.exit(1);
  }

  const config = loadConfig();
  const logger = createLogger(config.logLevel);
  const conversations = createConversationStore({ config, logger });

  await conversations.init();

  const events = await conversations.listEventsByConversationId({
    conversationId,
    limit,
  });

  const conversationList = await conversations.listConversations({ limit: 200 });
  const conversation = conversationList.find((item) => item.conversationId === conversationId) || {
    conversationId,
  };

  const output = conversations.formatConversationExport(events, {
    conversation,
    includeHeader,
    includeSystem,
    includeSummaries,
  });
  process.stdout.write(`${output}\n`);

  await conversations.close();
}

main().catch((error) => {
  console.error("[conversation:export] Failed to export conversation", error);
  process.exit(1);
});
