function createNoopMemoryProvider({ config, logger }) {
  return {
    async retrieve({ guildId, userId, query, mode }) {
      logger.debug("[memory] Memory search skipped because no memory backend is configured", {
        guildId: guildId || "n/a",
        userId,
        mode,
        qdrantConfigured: Boolean(config.qdrant.url),
      });

      void query;
      return [];
    },
  };
}

module.exports = {
  createNoopMemoryProvider,
};
