const { MessageFlags, SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("user-id")
    .setDescription("Find your Discord user ID."),

  async execute(interaction) {
    await interaction.reply({
      content: `Your Discord user ID: \`${interaction.user.id}\``,
      flags: MessageFlags.Ephemeral,
    });
  },
};

