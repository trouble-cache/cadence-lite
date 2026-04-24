const MAX_CONVERSATION_EXPORT_CONVERSATIONS = 1000;
const MAX_CONVERSATION_LOG_EXPORT_EVENTS = 10000;
const MAX_CONVERSATION_EVENT_CSV_ROWS = 100000;

const CONVERSATION_EVENT_EXPORT_COLUMNS = Object.freeze([
  "id",
  "created_at",
  "guild_id",
  "author_name",
  "source",
  "content_text",
  "channel_name",
  "thread_name",
  "input_types",
  "attachment_count",
]);

const CONVERSATION_LOG_INDEX_COLUMNS = Object.freeze([
  "conversation_id",
  "label",
  "filename",
  "guild_id",
  "channel_id",
  "thread_id",
  "event_count",
  "message_event_count",
  "first_event_at",
  "last_event_at",
]);

function normalizeMetadata(metadata = {}) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }

  return metadata;
}

function escapeCsvValue(value) {
  const normalized = value === null || value === undefined ? "" : String(value);

  if (!/[",\n]/.test(normalized)) {
    return normalized;
  }

  return `"${normalized.replace(/"/g, "\"\"")}"`;
}

function buildCsv(rows = [], columns = []) {
  const lines = [columns.map(escapeCsvValue).join(",")];

  for (const row of rows) {
    lines.push(columns.map((column) => escapeCsvValue(row[column])).join(","));
  }

  return lines.join("\n");
}

function buildConversationEventExportRows(events = []) {
  return events.map((event) => {
    const metadata = normalizeMetadata(event.metadata);
    const attachmentCount = Number(metadata.attachmentCount);
    const inputTypes = Array.isArray(metadata.inputTypes) ? metadata.inputTypes.join(", ") : "";

    return {
      id: event.id ?? "",
      created_at: event.created_at || "",
      guild_id: event.guild_id || "",
      author_name: event.author_name || "",
      source: event.source || "",
      content_text: event.content_text || "",
      channel_name: metadata.channelName || "",
      thread_name: metadata.threadName || "",
      input_types: inputTypes,
      attachment_count: Number.isFinite(attachmentCount)
        ? attachmentCount
        : (Array.isArray(metadata.attachments) ? metadata.attachments.length : 0),
    };
  });
}

function buildConversationEventsCsv(events = []) {
  return buildCsv(buildConversationEventExportRows(events), CONVERSATION_EVENT_EXPORT_COLUMNS);
}

function sanitizeFilenameSegment(value, fallback = "conversation") {
  const normalized = String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return normalized || fallback;
}

function buildConversationLogFilename(conversation = {}, usedFilenames = new Set()) {
  const datePart = String(conversation.firstEventAt || conversation.lastEventAt || "")
    .slice(0, 10)
    .trim() || "undated";
  const label = sanitizeFilenameSegment(conversation.label || conversation.threadName || conversation.channelName || "", "conversation");
  const conversationId = sanitizeFilenameSegment(conversation.conversationId || "", "conversation");
  const baseName = `${datePart}-${label}-${conversationId}`;
  let filename = `${baseName}.txt`;
  let suffix = 2;

  while (usedFilenames.has(filename)) {
    filename = `${baseName}-${suffix}.txt`;
    suffix += 1;
  }

  usedFilenames.add(filename);
  return filename;
}

function buildConversationLogIndexRows(entries = []) {
  return entries.map((entry) => ({
    conversation_id: entry.conversationId || "",
    label: entry.label || "",
    filename: entry.filename || "",
    guild_id: entry.guildId || "",
    channel_id: entry.channelId || "",
    thread_id: entry.threadId || "",
    event_count: Number(entry.eventCount || 0),
    message_event_count: Number(entry.messageEventCount || 0),
    first_event_at: entry.firstEventAt || "",
    last_event_at: entry.lastEventAt || "",
  }));
}

function buildConversationLogsIndexCsv(entries = []) {
  return buildCsv(buildConversationLogIndexRows(entries), CONVERSATION_LOG_INDEX_COLUMNS);
}

function buildConversationLogsMetadata({
  entries = [],
  generatedAt = new Date().toISOString(),
  conversationLimit = MAX_CONVERSATION_EXPORT_CONVERSATIONS,
  perConversationEventLimit = MAX_CONVERSATION_LOG_EXPORT_EVENTS,
} = {}) {
  return {
    product: "cadence-lite",
    exportType: "conversation_logs",
    generatedAt,
    conversationCount: entries.length,
    limits: {
      conversationLimit,
      perConversationEventLimit,
    },
    conversations: entries.map((entry) => ({
      conversationId: entry.conversationId || "",
      label: entry.label || "",
      filename: entry.filename || "",
      eventCount: Number(entry.eventCount || 0),
      messageEventCount: Number(entry.messageEventCount || 0),
      firstEventAt: entry.firstEventAt || null,
      lastEventAt: entry.lastEventAt || null,
    })),
  };
}

function buildCrc32Table() {
  const table = new Uint32Array(256);

  for (let index = 0; index < 256; index += 1) {
    let value = index;

    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) ? (0xEDB88320 ^ (value >>> 1)) : (value >>> 1);
    }

    table[index] = value >>> 0;
  }

  return table;
}

const CRC32_TABLE = buildCrc32Table();

function crc32(buffer) {
  let value = 0xFFFFFFFF;

  for (const byte of buffer) {
    value = CRC32_TABLE[(value ^ byte) & 0xFF] ^ (value >>> 8);
  }

  return (value ^ 0xFFFFFFFF) >>> 0;
}

function toDosDateTime(value = new Date()) {
  const date = new Date(value);
  const year = Math.max(1980, date.getUTCFullYear());
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const seconds = Math.floor(date.getUTCSeconds() / 2);

  return {
    date: ((year - 1980) << 9) | (month << 5) | day,
    time: (hours << 11) | (minutes << 5) | seconds,
  };
}

function createZipBuffer(files = [], { now = new Date() } = {}) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const file of files) {
    const nameBuffer = Buffer.from(String(file.name || ""), "utf8");
    const dataBuffer = Buffer.isBuffer(file.content)
      ? file.content
      : Buffer.from(String(file.content || ""), "utf8");
    const fileDate = file.modifiedAt || now;
    const { date, time } = toDosDateTime(fileDate);
    const checksum = crc32(dataBuffer);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034B50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(time, 10);
    localHeader.writeUInt16LE(date, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(dataBuffer.length, 18);
    localHeader.writeUInt32LE(dataBuffer.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, nameBuffer, dataBuffer);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014B50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(time, 12);
    centralHeader.writeUInt16LE(date, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(dataBuffer.length, 20);
    centralHeader.writeUInt32LE(dataBuffer.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, nameBuffer);
    offset += localHeader.length + nameBuffer.length + dataBuffer.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const localDirectory = Buffer.concat(localParts);
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054B50, 0);
  endRecord.writeUInt16LE(0, 4);
  endRecord.writeUInt16LE(0, 6);
  endRecord.writeUInt16LE(files.length, 8);
  endRecord.writeUInt16LE(files.length, 10);
  endRecord.writeUInt32LE(centralDirectory.length, 12);
  endRecord.writeUInt32LE(localDirectory.length, 16);
  endRecord.writeUInt16LE(0, 20);

  return Buffer.concat([localDirectory, centralDirectory, endRecord]);
}

module.exports = {
  MAX_CONVERSATION_EXPORT_CONVERSATIONS,
  MAX_CONVERSATION_LOG_EXPORT_EVENTS,
  MAX_CONVERSATION_EVENT_CSV_ROWS,
  CONVERSATION_EVENT_EXPORT_COLUMNS,
  CONVERSATION_LOG_INDEX_COLUMNS,
  buildConversationEventExportRows,
  buildConversationEventsCsv,
  sanitizeFilenameSegment,
  buildConversationLogFilename,
  buildConversationLogIndexRows,
  buildConversationLogsIndexCsv,
  buildConversationLogsMetadata,
  createZipBuffer,
};
