function handleReady({ logger }) {
  return (client) => {
    logger.info(`[bot] Logged in as ${client.user.tag}`);
  };
}

module.exports = {
  handleReady,
};
