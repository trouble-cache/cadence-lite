const { loadConfig } = require("./config/env");
const { applyRuntimeSettings } = require("./config/runtimeSettings");
const { createLogger } = require("./utils/logger");
const { createHealthServer } = require("./http/createHealthServer");
const { createDiscordClient } = require("./bot/createDiscordClient");
const { registerEventHandlers } = require("./bot/registerEventHandlers");
const { loadCommands } = require("./bot/commands");
const { createMemoryService } = require("./memory");
const { createToolRegistry } = require("./tools");
const { createChatPipeline } = require("./chat/createChatPipeline");
const { createConversationStore, createMemoryStore, createSettingsStore, createJournalStore, createAutomationStore } = require("./storage");
const { createAutomationRunner } = require("./automations");

async function startApp() {
  const config = loadConfig();
  const logger = createLogger(config.logLevel);

  logger.info("[app] Starting Cadence", {
    nodeEnv: config.nodeEnv,
    product: "cadence-lite",
  });

  const settingsStore = createSettingsStore({ config, logger });
  await settingsStore.init();
  applyRuntimeSettings(config, await settingsStore.listSettings());

  const commands = loadCommands(config);
  const memoryStore = createMemoryStore({ config, logger });
  const memory = createMemoryService({ config, logger, memoryStore });
  const journalStore = createJournalStore({ config, logger });
  const automationStore = createAutomationStore({ config, logger });
  const tools = createToolRegistry({ config, logger });
  const conversations = createConversationStore({ config, logger });
  const chatPipeline = createChatPipeline({ config, logger, memory, tools, conversations });
  const client = createDiscordClient({ config });
  const automationRunner = createAutomationRunner({
    client,
    config,
    logger,
    automationStore,
    memory,
    journalStore,
    tools,
    conversations,
  });
  const appContext = {
    config,
    conversations,
    logger,
    memoryStore,
    settingsStore,
    journalStore,
    automationStore,
    ready: false,
  };
  client.appContext = {
    config,
    conversations,
    logger,
    settingsStore,
    journalStore,
  };

  createHealthServer({
    port: config.port,
    logger,
    appContext,
  });

  await conversations.init();
  await memoryStore.init();
  await journalStore.init();
  await automationStore.init();
  appContext.ready = true;

  registerEventHandlers({ client, config, logger, commands, chatPipeline, conversations });

  if (!config.discord.token) {
    logger.error("[bot] DISCORD_TOKEN is missing. Railway health checks will still pass, but the bot cannot log in.");
    process.exitCode = 1;
    return;
  }

  await client.login(config.discord.token);
  automationRunner.start();
  await automationRunner.runNow();
}

startApp().catch((error) => {
  console.error("[app] Failed to start Cadence", error);
  process.exit(1);
});
