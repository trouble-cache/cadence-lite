function handleReady({ config, logger }) {
  return (client) => {
    logger.info(`[bot] Discord connection is live as ${client.user.tag}`, {
      respondToMentionsOnly: Boolean(config.discord.respondToMentionsOnly),
    });
  };
}

module.exports = {
  handleReady,
};
