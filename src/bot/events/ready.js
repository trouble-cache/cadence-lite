function handleReady({ logger }) {
  return (client) => {
    logger.info(`[bot] Discord connection is live as ${client.user.tag}`);
  };
}

module.exports = {
  handleReady,
};
