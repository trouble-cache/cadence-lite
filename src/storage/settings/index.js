const { createPostgresPool } = require("../postgres/createPostgresPool");

const CREATE_APP_SETTINGS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS app_settings (
    setting_key TEXT PRIMARY KEY,
    setting_value JSONB NOT NULL DEFAULT 'null'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`;

function normalizeSettingKey(value) {
  const key = String(value || "").trim();

  if (!key) {
    throw new Error("Setting key is required.");
  }

  return key;
}

function createNoopSettingsStore({ logger }) {
  return {
    async init() {
      logger.warn("[settings] DATABASE_URL is not set; app settings persistence is disabled.");
    },
    async listSettings() {
      return {};
    },
    async upsertSettings() {
      throw new Error("Settings store is disabled because DATABASE_URL is not set.");
    },
    async close() {},
  };
}

function createSettingsStore({ config, logger }) {
  const pool = createPostgresPool({ config });

  if (!pool) {
    return createNoopSettingsStore({ logger });
  }

  return {
    async init() {
      await pool.query(CREATE_APP_SETTINGS_TABLE_SQL);
      logger.info("[settings] App settings store ready", {
        provider: "postgres",
      });
    },

    async listSettings() {
      const { rows } = await pool.query(
        `
          SELECT setting_key, setting_value
          FROM app_settings
          ORDER BY setting_key ASC
        `,
      );

      return Object.fromEntries(rows.map((row) => [row.setting_key, row.setting_value]));
    },

    async upsertSettings(settings) {
      const entries = Object.entries(settings || {});

      for (const [key, value] of entries) {
        await pool.query(
          `
            INSERT INTO app_settings (setting_key, setting_value, updated_at)
            VALUES ($1, $2::jsonb, NOW())
            ON CONFLICT (setting_key)
            DO UPDATE SET
              setting_value = EXCLUDED.setting_value,
              updated_at = NOW()
          `,
          [normalizeSettingKey(key), JSON.stringify(value)],
        );
      }

      return this.listSettings();
    },

    async close() {
      await pool.end();
    },
  };
}

module.exports = {
  createSettingsStore,
};
