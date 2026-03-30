const { loadConfig } = require("../src/config/env");
const { createLogger } = require("../src/utils/logger");
const { createConversationStore } = require("../src/storage");

function parseLimit(value) {
  const limit = Number(value);
  return Number.isFinite(limit) && limit > 0 ? limit : 20;
}

function formatConversationRow(conversation, index) {
  return [
    `${index + 1}. ${conversation.label}`,
    `   conversation_id: ${conversation.conversationId}`,
    `   channel_id: ${conversation.channelId}`,
    `   thread_id: ${conversation.threadId || "none"}`,
    `   events: ${conversation.eventCount} (${conversation.messageEventCount} messages)`,
    `   range: ${new Date(conversation.firstEventAt).toISOString()} -> ${new Date(conversation.lastEventAt).toISOString()}`,
    `   latest_summary_date: ${conversation.latestSummaryDate || "none"}`,
  ].join("\n");
}

async function main() {
  const limit = parseLimit(process.argv[2]);
  const config = loadConfig();
  const logger = createLogger(config.logLevel);
  const conversations = createConversationStore({ config, logger });

  await conversations.init();

  const rows = await conversations.listConversations({ limit });

  if (!rows.length) {
    process.stdout.write("No stored conversations found.\n");
    await conversations.close();
    return;
  }

  process.stdout.write(`${rows.map(formatConversationRow).join("\n\n")}\n`);

  await conversations.close();
}

main().catch((error) => {
  console.error("[conversations:list] Failed to list conversations", error);
  process.exit(1);
});
