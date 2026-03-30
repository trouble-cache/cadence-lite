const { Pool } = require("pg");

function createPostgresPool({ config }) {
  if (!config.database.url) {
    return null;
  }

  return new Pool({
    connectionString: config.database.url,
  });
}

module.exports = {
  createPostgresPool,
};
