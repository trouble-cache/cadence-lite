const crypto = require("node:crypto");
const { createPostgresPool } = require("../postgres/createPostgresPool");

const CREATE_JOURNAL_ENTRIES_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS journal_entries (
    id BIGSERIAL PRIMARY KEY,
    entry_id UUID NOT NULL UNIQUE,
    user_scope TEXT NOT NULL,
    automation_id UUID,
    channel_id TEXT,
    guild_id TEXT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`;

const CREATE_JOURNAL_ENTRIES_INDEXES_SQL = [
  "CREATE INDEX IF NOT EXISTS journal_entries_user_scope_created_at_idx ON journal_entries (user_scope, created_at DESC);",
  "CREATE INDEX IF NOT EXISTS journal_entries_automation_created_at_idx ON journal_entries (automation_id, created_at DESC);",
];

function normalizeText(value, label, { allowEmpty = false } = {}) {
  const normalized = String(value || "").trim();

  if (!allowEmpty && !normalized) {
    throw new Error(`${label} is required.`);
  }

  return normalized;
}

function normalizeTimestamp(value) {
  if (!value) {
    return new Date().toISOString();
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid timestamp "${value}".`);
  }

  return date.toISOString();
}

function normalizeJournalEntryRecord(record = {}, defaults = {}) {
  return {
    entryId: normalizeText(record.entryId || record.entry_id || record.id, "Entry ID", { allowEmpty: true }) || crypto.randomUUID(),
    userScope: normalizeText(record.userScope || record.user_scope || defaults.userScope, "User scope"),
    automationId: normalizeText(record.automationId || record.automation_id || defaults.automationId, "Automation ID", { allowEmpty: true }) || null,
    channelId: normalizeText(record.channelId || record.channel_id || defaults.channelId, "Channel ID", { allowEmpty: true }) || null,
    guildId: normalizeText(record.guildId || record.guild_id || defaults.guildId, "Guild ID", { allowEmpty: true }) || null,
    title: normalizeText(record.title || defaults.title || "Journal entry", "Journal title"),
    content: normalizeText(record.content, "Journal content"),
    createdAt: normalizeTimestamp(record.createdAt || record.created_at || defaults.createdAt),
  };
}

function mapJournalEntryRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: Number(row.id),
    entryId: row.entry_id,
    userScope: row.user_scope,
    automationId: row.automation_id,
    channelId: row.channel_id,
    guildId: row.guild_id,
    title: row.title,
    content: row.content,
    createdAt: row.created_at,
  };
}

function createNoopJournalStore({ logger }) {
  return {
    persistenceEnabled: false,
    async init() {
      logger.warn("[journals] DATABASE_URL is not set, so journals will not be saved.");
    },
    async listEntries() {
      return [];
    },
    async listRecentEntries() {
      return [];
    },
    async countEntries() {
      return 0;
    },
    async recordEntry() {
      throw new Error("Journal store is disabled because DATABASE_URL is not set.");
    },
    async deleteEntryById() {
      return null;
    },
    async close() {},
  };
}

function createJournalStore({ config, logger }) {
  const pool = createPostgresPool({ config });

  if (!pool) {
    return createNoopJournalStore({ logger });
  }

  return {
    persistenceEnabled: true,
    async init() {
      await pool.query(CREATE_JOURNAL_ENTRIES_TABLE_SQL);

      for (const statement of CREATE_JOURNAL_ENTRIES_INDEXES_SQL) {
        await pool.query(statement);
      }

      logger.info("[journals] Journal storage is ready", {
        provider: "postgres",
      });
    },

    async listEntries({ userScope, limit = 5000, offset = 0 } = {}) {
      const normalizedScope = normalizeText(userScope, "User scope");
      const safeLimit = Math.max(1, Math.min(Number(limit) || 5000, 10000));
      const safeOffset = Math.max(0, Number(offset) || 0);
      const { rows } = await pool.query(
        `
          SELECT
            id,
            entry_id,
            user_scope,
            automation_id,
            channel_id,
            guild_id,
            title,
            content,
            created_at
          FROM journal_entries
          WHERE user_scope = $1
          ORDER BY created_at DESC, id DESC
          LIMIT $2
          OFFSET $3
        `,
        [normalizedScope, safeLimit, safeOffset],
      );

      return rows.map(mapJournalEntryRow);
    },

    async listRecentEntries({ userScope, limit = 5, offset = 0 } = {}) {
      const normalizedScope = normalizeText(userScope, "User scope");
      const safeLimit = Math.max(1, Math.min(Number(limit) || 5, 20));
      const safeOffset = Math.max(0, Number(offset) || 0);
      const { rows } = await pool.query(
        `
          SELECT
            id,
            entry_id,
            user_scope,
            automation_id,
            channel_id,
            guild_id,
            title,
            content,
            created_at
          FROM journal_entries
          WHERE user_scope = $1
          ORDER BY created_at DESC, id DESC
          LIMIT $2
          OFFSET $3
        `,
        [normalizedScope, safeLimit, safeOffset],
      );

      return rows.map(mapJournalEntryRow);
    },

    async countEntries({ userScope } = {}) {
      const normalizedScope = normalizeText(userScope, "User scope");
      const { rows } = await pool.query(
        `
          SELECT COUNT(*)::int AS entry_count
          FROM journal_entries
          WHERE user_scope = $1
        `,
        [normalizedScope],
      );

      return Number(rows[0]?.entry_count || 0);
    },

    async recordEntry(record, defaults = {}) {
      const normalized = normalizeJournalEntryRecord(record, defaults);
      const { rows } = await pool.query(
        `
          INSERT INTO journal_entries (
            entry_id,
            user_scope,
            automation_id,
            channel_id,
            guild_id,
            title,
            content,
            created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING
            id,
            entry_id,
            user_scope,
            automation_id,
            channel_id,
            guild_id,
            title,
            content,
            created_at
        `,
        [
          normalized.entryId,
          normalized.userScope,
          normalized.automationId,
          normalized.channelId,
          normalized.guildId,
          normalized.title,
          normalized.content,
          normalized.createdAt,
        ],
      );

      return mapJournalEntryRow(rows[0]);
    },

    async deleteEntryById(entryId, { userScope } = {}) {
      const normalizedEntryId = normalizeText(entryId, "Entry ID");
      const normalizedScope = normalizeText(userScope, "User scope");
      const { rows } = await pool.query(
        `
          DELETE FROM journal_entries
          WHERE entry_id = $1
            AND user_scope = $2
          RETURNING
            id,
            entry_id,
            user_scope,
            automation_id,
            channel_id,
            guild_id,
            title,
            content,
            created_at
        `,
        [normalizedEntryId, normalizedScope],
      );

      return mapJournalEntryRow(rows[0] || null);
    },

    async close() {
      await pool.end();
    },
  };
}

module.exports = {
  createJournalStore,
  normalizeJournalEntryRecord,
};
