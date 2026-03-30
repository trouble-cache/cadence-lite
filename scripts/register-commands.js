const { loadConfig } = require("../src/config/env");
const { registerDiscordCommands } = require("../src/bot/registerCommands");

const config = loadConfig();

(async () => {
  try {
    const result = await registerDiscordCommands({ config, logger: console });
    console.log(`[commands] Slash commands registered successfully (${result.commandCount}).`);
  } catch (error) {
    console.error("[commands] Failed to register slash commands", error);
    process.exit(1);
  }
})();
