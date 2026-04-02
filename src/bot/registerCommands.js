const { REST, Routes } = require("discord.js");
const { loadCommands } = require("./commands");

function assertCommandRegistrationConfig(config) {
  if (!config?.discord?.token || !config?.discord?.clientId || !config?.discord?.guildId) {
    throw new Error("DISCORD_TOKEN, DISCORD_CLIENT_ID, and DISCORD_GUILD_ID must be set before registering commands.");
  }
}

async function registerDiscordCommands({ config, logger = console }) {
  assertCommandRegistrationConfig(config);

  const commands = loadCommands(config).map((command) => command.data.toJSON());
  const rest = new REST({ version: "10" }).setToken(config.discord.token);

  logger.info("[commands] Registering Discord slash commands", {
    guildId: config.discord.guildId,
    commandCount: commands.length,
    product: "cadence-lite",
  });

  await rest.put(Routes.applicationGuildCommands(config.discord.clientId, config.discord.guildId), {
    body: commands,
  });

  logger.info("[commands] Discord slash commands are ready", {
    guildId: config.discord.guildId,
    commandCount: commands.length,
  });

  return {
    commandCount: commands.length,
    guildId: config.discord.guildId,
  };
}

module.exports = {
  assertCommandRegistrationConfig,
  registerDiscordCommands,
};
