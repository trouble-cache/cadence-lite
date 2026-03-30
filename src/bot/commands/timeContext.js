const { MessageFlags, SlashCommandBuilder } = require("discord.js");
const { applyRuntimeSettings } = require("../../config/runtimeSettings");

function formatState(enabled) {
  return enabled ? "on" : "off";
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("time-context")
    .setDescription("Check whether date and time sharing is currently on.")
    .addSubcommand((subcommand) => subcommand
      .setName("view")
      .setDescription("Show whether explicit time context is currently enabled."))
    .addSubcommand((subcommand) => subcommand
      .setName("on")
      .setDescription("Let your AI see the current date and time in messages."))
    .addSubcommand((subcommand) => subcommand
      .setName("off")
      .setDescription("Stop sharing the current date and time in messages.")),

  async execute(interaction) {
    const { config, settingsStore } = interaction.client.appContext;
    const subcommand = interaction.options.getSubcommand();
    const currentValue = config.chat?.includeTimeContext !== false;

    if (subcommand === "view") {
      await interaction.reply({
        content: `Date and time sharing is currently \`${formatState(currentValue)}\`.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const nextValue = subcommand === "on";
    const persisted = await settingsStore.upsertSettings({
      "chat.includeTimeContext": nextValue,
    });
    applyRuntimeSettings(config, persisted);

    await interaction.reply({
      content: nextValue
        ? "Date and time sharing is now `on`. Your AI will see the current date and time in messages again."
        : "Date and time sharing is now `off`. Your AI will no longer see the current date and time in messages.",
      flags: MessageFlags.Ephemeral,
    });
  },
};

