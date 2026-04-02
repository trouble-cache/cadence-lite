const crypto = require("node:crypto");
const { createPostgresPool } = require("../postgres/createPostgresPool");
const { assertSupportedMemoryDomain } = require("../../memory/domains");

const SUPPORTED_MEMORY_TYPES = Object.freeze([
  "anchor",
  "canon",
  "resolved",
]);

const SUPPORTED_SENSITIVITY_LEVELS = Object.freeze([
  "low",
  "medium",
  "high",
]);

const DEFAULT_IMPORTANCE_BY_TYPE = Object.freeze({
  anchor: 5,
  canon: 4,
  resolved: 3,
});

const CREATE_MEMORIES_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS memories (
    id BIGSERIAL PRIMARY KEY,
    memory_id UUID NOT NULL UNIQUE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    memory_type TEXT NOT NULL,
    domain TEXT NOT NULL,
    sensitivity TEXT NOT NULL,
    source TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    importance INTEGER NOT NULL,
    user_scope TEXT NOT NULL,
    reference_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,
    use_count INTEGER NOT NULL DEFAULT 0
  );
`;

const CREATE_MEMORIES_INDEXES_SQL = [
  "CREATE INDEX IF NOT EXISTS memories_user_scope_active_idx ON memories (user_scope, active);",
  "CREATE INDEX IF NOT EXISTS memories_memory_type_idx ON memories (memory_type);",
  "CREATE INDEX IF NOT EXISTS memories_domain_idx ON memories (domain);",
  "CREATE INDEX IF NOT EXISTS memories_reference_date_idx ON memories (reference_date DESC);",
  "CREATE INDEX IF NOT EXISTS memories_updated_at_idx ON memories (updated_at DESC);",
];

const ALTER_MEMORIES_TABLE_SQL = [
  "ALTER TABLE memories ADD COLUMN IF NOT EXISTS reference_date DATE;",
  "ALTER TABLE memories ADD COLUMN IF NOT EXISTS use_count INTEGER NOT NULL DEFAULT 0;",
];

function normalizeTextValue(value) {
  return String(value || "").trim();
}

function normalizeEnumValue(value) {
  return normalizeTextValue(value).toLowerCase();
}

function normalizeDomain(value) {
  return assertSupportedMemoryDomain(value);
}

function normalizeBoolean(value, defaultValue = true) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  if (typeof value === "boolean") {
    return value;
  }

  const normalized = normalizeEnumValue(value);
  return ["1", "true", "yes", "on"].includes(normalized);
}

function normalizeTimestamp(value, fallbackValue = null) {
  if (!value) {
    return fallbackValue;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid timestamp value "${value}".`);
  }

  return date.toISOString();
}

function normalizeDateValue(value, fallbackValue = null) {
  if (!value) {
    return fallbackValue;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date value "${value}".`);
  }

  return date.toISOString().slice(0, 10);
}

function assertAllowedValue({ label, value, allowedValues }) {
  const normalizedValue = normalizeEnumValue(value);

  if (!allowedValues.includes(normalizedValue)) {
    throw new Error(`Unsupported ${label} "${value}". Expected one of: ${allowedValues.join(", ")}.`);
  }

  return normalizedValue;
}

function deriveImportance(memoryType, explicitImportance) {
  if (explicitImportance !== undefined && explicitImportance !== null && explicitImportance !== "") {
    const parsed = Number(explicitImportance);

    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error(`Invalid importance "${explicitImportance}". Expected a positive number.`);
    }

    return parsed;
  }

  return DEFAULT_IMPORTANCE_BY_TYPE[memoryType];
}

function deriveTitle(record) {
  const title = normalizeTextValue(record.title);

  if (title) {
    return title;
  }

  throw new Error("Memory record title is required.");
}

function deriveContent(record) {
  const content = normalizeTextValue(record.content || record.text);

  if (!content) {
    throw new Error("Memory record content is required.");
  }

  return content;
}

function normalizeMemoryRecord(record, defaults = {}) {
  const memoryType = assertAllowedValue({
    label: "memory_type",
    value: record.memory_type || record.type,
    allowedValues: SUPPORTED_MEMORY_TYPES,
  });

  const sensitivity = assertAllowedValue({
    label: "sensitivity",
    value: record.sensitivity || "low",
    allowedValues: SUPPORTED_SENSITIVITY_LEVELS,
  });

  const domain = normalizeDomain(record.domain || defaults.domain || "general");

  if (!domain) {
    throw new Error("Memory record domain is required.");
  }

  const now = new Date().toISOString();

  return {
    memoryId: normalizeTextValue(record.memory_id || record.memoryId || record.id) || crypto.randomUUID(),
    title: deriveTitle(record),
    content: deriveContent(record),
    memoryType,
    domain,
    sensitivity,
    source: normalizeTextValue(record.source || defaults.source || "manual_import"),
    active: normalizeBoolean(record.active, defaults.active ?? true),
    importance: deriveImportance(memoryType, record.importance ?? defaults.importance),
    userScope: normalizeTextValue(record.user_scope || record.userScope || defaults.userScope || "default"),
    referenceDate: normalizeDateValue(record.reference_date || record.referenceDate || defaults.referenceDate, null),
    createdAt: normalizeTimestamp(record.created_at || record.createdAt, now),
    updatedAt: normalizeTimestamp(record.updated_at || record.updatedAt, now),
    lastUsedAt: normalizeTimestamp(record.last_used_at || record.lastUsedAt, null),
  };
}

function mapMemoryRow(row) {
  return {
    id: Number(row.id),
    memoryId: row.memory_id,
    title: row.title,
    content: row.content,
    memoryType: row.memory_type,
    domain: row.domain,
    sensitivity: row.sensitivity,
    source: row.source,
    active: row.active,
    importance: Number(row.importance),
    userScope: row.user_scope,
    referenceDate: row.reference_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastUsedAt: row.last_used_at,
    useCount: Number(row.use_count || 0),
  };
}

function createNoopMemoryStore({ logger }) {
  return {
    async init() {
      logger.warn("[memory] DATABASE_URL is not set, so durable memories will not be saved.");
    },
    async upsertMemory() {
      throw new Error("Memory store is disabled because DATABASE_URL is not set.");
    },
    async getMemoryById() {
      return null;
    },
    async getMemoriesByIds() {
      return [];
    },
    async touchMemoriesByIds() {
      return 0;
    },
    async deleteMemoryById() {
      throw new Error("Memory store is disabled because DATABASE_URL is not set.");
    },
    async listMemories() {
      return [];
    },
    async close() {},
  };
}

function createMemoryStore({ config, logger }) {
  const pool = createPostgresPool({ config });

  if (!pool) {
    return createNoopMemoryStore({ logger });
  }

  return {
    async init() {
      await pool.query(CREATE_MEMORIES_TABLE_SQL);
      for (const statement of ALTER_MEMORIES_TABLE_SQL) {
        await pool.query(statement);
      }

      for (const statement of CREATE_MEMORIES_INDEXES_SQL) {
        await pool.query(statement);
      }

      logger.info("[memory] Durable memory storage is ready", {
        provider: "postgres",
      });
    },

    async upsertMemory(record, defaults = {}) {
      const normalized = normalizeMemoryRecord(record, defaults);
      const { rows } = await pool.query(
        `
          INSERT INTO memories (
            memory_id,
            title,
            content,
            memory_type,
            domain,
            sensitivity,
            source,
            active,
            importance,
            user_scope,
            reference_date,
            created_at,
            updated_at,
            last_used_at,
            use_count
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, DEFAULT)
          ON CONFLICT (memory_id)
          DO UPDATE SET
            title = EXCLUDED.title,
            content = EXCLUDED.content,
            memory_type = EXCLUDED.memory_type,
            domain = EXCLUDED.domain,
            sensitivity = EXCLUDED.sensitivity,
            source = EXCLUDED.source,
            active = EXCLUDED.active,
            importance = EXCLUDED.importance,
            user_scope = EXCLUDED.user_scope,
            reference_date = EXCLUDED.reference_date,
            created_at = EXCLUDED.created_at,
            updated_at = EXCLUDED.updated_at,
            last_used_at = EXCLUDED.last_used_at
          RETURNING
            id,
            memory_id,
            title,
            content,
            memory_type,
            domain,
            sensitivity,
            source,
            active,
            importance,
            user_scope,
            reference_date,
            created_at,
            updated_at,
            last_used_at,
            use_count
        `,
        [
          normalized.memoryId,
          normalized.title,
          normalized.content,
          normalized.memoryType,
          normalized.domain,
          normalized.sensitivity,
          normalized.source,
          normalized.active,
          normalized.importance,
          normalized.userScope,
          normalized.referenceDate,
          normalized.createdAt,
          normalized.updatedAt,
          normalized.lastUsedAt,
        ],
      );

      return mapMemoryRow(rows[0]);
    },

    async getMemoryById(memoryId, { userScope } = {}) {
      const normalizedMemoryId = normalizeTextValue(memoryId);

      if (!normalizedMemoryId) {
        throw new Error("Memory ID is required.");
      }

      const values = [normalizedMemoryId];
      const clauses = ["memory_id = $1"];

      if (userScope) {
        values.push(normalizeTextValue(userScope));
        clauses.push(`user_scope = $${values.length}`);
      }

      const { rows } = await pool.query(
        `
          SELECT
            id,
            memory_id,
            title,
            content,
            memory_type,
            domain,
            sensitivity,
            source,
            active,
            importance,
            user_scope,
            reference_date,
            created_at,
            updated_at,
            last_used_at,
            use_count
          FROM memories
          WHERE ${clauses.join(" AND ")}
          LIMIT 1
        `,
        values,
      );

      return rows[0] ? mapMemoryRow(rows[0]) : null;
    },

    async getMemoriesByIds(memoryIds, { userScope } = {}) {
      const normalizedIds = Array.isArray(memoryIds)
        ? memoryIds.map((memoryId) => normalizeTextValue(memoryId)).filter(Boolean)
        : [];

      if (!normalizedIds.length) {
        return [];
      }

      const values = [normalizedIds];
      const clauses = ["memory_id = ANY($1::uuid[])"];

      if (userScope) {
        values.push(normalizeTextValue(userScope));
        clauses.push(`user_scope = $${values.length}`);
      }

      const { rows } = await pool.query(
        `
          SELECT
            id,
            memory_id,
            title,
            content,
            memory_type,
            domain,
            sensitivity,
            source,
            active,
            importance,
            user_scope,
            reference_date,
            created_at,
            updated_at,
            last_used_at,
            use_count
          FROM memories
          WHERE ${clauses.join(" AND ")}
        `,
        values,
      );

      return rows.map(mapMemoryRow);
    },

    async touchMemoriesByIds(memoryIds, { userScope, usedAt = new Date().toISOString() } = {}) {
      const normalizedIds = Array.isArray(memoryIds)
        ? memoryIds.map((memoryId) => normalizeTextValue(memoryId)).filter(Boolean)
        : [];

      if (!normalizedIds.length) {
        return 0;
      }

      const values = [normalizedIds, normalizeTimestamp(usedAt, new Date().toISOString())];
      const clauses = ["memory_id = ANY($1::uuid[])"];

      if (userScope) {
        values.push(normalizeTextValue(userScope));
        clauses.push(`user_scope = $${values.length}`);
      }

      const { rowCount } = await pool.query(
        `
          UPDATE memories
          SET
            last_used_at = $2,
            use_count = use_count + 1
          WHERE ${clauses.join(" AND ")}
        `,
        values,
      );

      return rowCount;
    },

    async deleteMemoryById(memoryId, { userScope } = {}) {
      const normalizedMemoryId = normalizeTextValue(memoryId);

      if (!normalizedMemoryId) {
        throw new Error("Memory ID is required.");
      }

      const values = [normalizedMemoryId];
      const clauses = ["memory_id = $1"];

      if (userScope) {
        values.push(normalizeTextValue(userScope));
        clauses.push(`user_scope = $${values.length}`);
      }

      const { rows } = await pool.query(
        `
          DELETE FROM memories
          WHERE ${clauses.join(" AND ")}
          RETURNING
            id,
            memory_id,
            title,
            content,
            memory_type,
            domain,
            sensitivity,
            source,
            active,
            importance,
            user_scope,
            reference_date,
            created_at,
            updated_at,
            last_used_at,
            use_count
        `,
        values,
      );

      return rows[0] ? mapMemoryRow(rows[0]) : null;
    },

    async listMemories({ userScope, limit = 100, activeOnly = false } = {}) {
      const clauses = [];
      const values = [];

      if (userScope) {
        values.push(userScope);
        clauses.push(`user_scope = $${values.length}`);
      }

      if (activeOnly) {
        clauses.push("active = TRUE");
      }

      values.push(limit);
      const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

      const { rows } = await pool.query(
        `
          SELECT
            id,
            memory_id,
            title,
            content,
            memory_type,
            domain,
            sensitivity,
            source,
            active,
            importance,
            user_scope,
            reference_date,
            created_at,
            updated_at,
            last_used_at,
            use_count
          FROM memories
          ${whereClause}
          ORDER BY updated_at DESC
          LIMIT $${values.length}
        `,
        values,
      );

      return rows.map(mapMemoryRow);
    },

    async close() {
      await pool.end();
    },
  };
}

module.exports = {
  SUPPORTED_MEMORY_TYPES,
  SUPPORTED_SENSITIVITY_LEVELS,
  DEFAULT_IMPORTANCE_BY_TYPE,
  normalizeDomain,
  normalizeDateValue,
  normalizeMemoryRecord,
  mapMemoryRow,
  createMemoryStore,
};
