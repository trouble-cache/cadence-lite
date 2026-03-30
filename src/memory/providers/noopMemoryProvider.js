function createNoopMemoryProvider({ config, logger }) {
  return {
    async retrieve({ guildId, userId, query, mode }) {
      logger.info(
        `[memory] No memory backend configured yet (guild=${guildId || "n/a"}, user=${userId}, mode=${mode}, qdrantConfigured=${Boolean(config.qdrant.url)})`,
      );

      void query;
      return [];
    },
  };
}

module.exports = {
  createNoopMemoryProvider,
};
