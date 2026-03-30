const { deletePoints } = require("./qdrantClient");

async function deleteMemoryEverywhere({
  config,
  memoryStore,
  memoryId,
  userScope = "",
}) {
  const existing = await memoryStore.getMemoryById(memoryId, { userScope });

  if (!existing) {
    return {
      deleted: false,
      reason: "not_found",
      memory: null,
    };
  }

  if (config.qdrant?.url) {
    await deletePoints({
      config,
      ids: [existing.memoryId],
    });
  }

  const deletedMemory = await memoryStore.deleteMemoryById(existing.memoryId, {
    userScope,
  });

  return {
    deleted: Boolean(deletedMemory),
    reason: deletedMemory ? "deleted" : "delete_failed",
    memory: deletedMemory,
  };
}

module.exports = {
  deleteMemoryEverywhere,
};
