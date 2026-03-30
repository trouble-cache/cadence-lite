const test = require("node:test");
const assert = require("node:assert/strict");

const { deleteMemoryEverywhere } = require("../src/memory/deleteMemories");

test("deleteMemoryEverywhere deletes live memory", async () => {
  const calls = [];
  const memory = {
    memoryId: "abc-123",
    title: "Test memory",
  };
  const originalFetch = global.fetch;
  global.fetch = async (url, options) => {
    calls.push(["fetch", url, options.method]);
    return {
      ok: true,
      status: 200,
      async json() {
        return { status: "ok" };
      },
    };
  };

  try {
    const result = await deleteMemoryEverywhere({
      config: {
        qdrant: {
          url: "http://qdrant.test",
          apiKey: "",
          collection: "memories",
        },
      },
      memoryStore: {
        async getMemoryById(memoryId) {
          calls.push(["getMemoryById", memoryId]);
          return memory;
        },
        async deleteMemoryById(memoryId) {
          calls.push(["deleteMemoryById", memoryId]);
          return memory;
        },
      },
      memoryId: "abc-123",
      userScope: "georgia",
    });

    assert.equal(result.deleted, true);
    assert.equal(result.memory.memoryId, "abc-123");
    assert.deepEqual(calls, [
      ["getMemoryById", "abc-123"],
      ["fetch", "http://qdrant.test/collections/memories/points/delete?wait=true", "POST"],
      ["deleteMemoryById", "abc-123"],
    ]);
  } finally {
    global.fetch = originalFetch;
  }
});

test("deleteMemoryEverywhere reports not_found when the memory does not exist", async () => {
  const result = await deleteMemoryEverywhere({
    config: {
      qdrant: {
        url: "",
      },
    },
    memoryStore: {
      async getMemoryById() {
        return null;
      },
    },
    memoryId: "missing",
    userScope: "georgia",
  });

  assert.deepEqual(result, {
    deleted: false,
    reason: "not_found",
    memory: null,
  });
});
