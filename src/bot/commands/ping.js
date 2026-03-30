const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check whether your AI is responding."),

  async execute(interaction) {
    await interaction.reply("Pong!");
  },
};
