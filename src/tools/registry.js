function createToolRegistry() {
  const tools = [];

  return {
    list() {
      return tools;
    },
  };
}

module.exports = {
  createToolRegistry,
};
