const { MessageFlags, SlashCommandBuilder } = require("discord.js");

function buildChannelMessage(interaction) {
  const channelId = interaction.channelId || interaction.channel?.id || "";

  if (!channelId) {
    return "I couldn't find a channel ID here.";
  }

  const parentId = interaction.channel?.isThread?.() ? interaction.channel?.parentId : null;

  if (parentId) {
    return [
      `Current thread ID: \`${channelId}\``,
      `Parent channel ID: \`${parentId}\``,
      "You can paste either into automations, depending on where you want the messages to land.",
    ].join("\n");
  }

  return [
    `Current channel ID: \`${channelId}\``,
    "Paste this into automations if you want scheduled messages to post here.",
  ].join("\n");
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("channel-id")
    .setDescription("Show the current channel or thread ID."),

  async execute(interaction) {
    await interaction.reply({
      content: buildChannelMessage(interaction),
      flags: MessageFlags.Ephemeral,
    });
  },
};

