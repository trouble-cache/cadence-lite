const { MessageFlags } = require("discord.js");

function createInteractionHandler({ logger }) {
  return async (interaction) => {
    if (interaction.isAutocomplete()) {
      const command = interaction.client.commands.get(interaction.commandName);

      if (!command?.autocomplete) {
        return;
      }

      try {
        await command.autocomplete(interaction);
      } catch (error) {
        logger.error(`[bot] Error while autocompleting /${interaction.commandName}`, error);
      }

      return;
    }

    if (!interaction.isChatInputCommand()) {
      return;
    }

    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
      await interaction.reply({
        content: "That command is not available right now.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      logger.error(`[bot] Error while handling /${interaction.commandName}`, error);

      const response = {
        content: "Something went wrong while running that command.",
        flags: MessageFlags.Ephemeral,
      };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(response);
        return;
      }

      await interaction.reply(response);
    }
  };
}

module.exports = {
  createInteractionHandler,
};
