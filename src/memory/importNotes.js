const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

function splitFrontmatter(text) {
  if (!text.startsWith("---\n")) {
    throw new Error("Expected note to start with YAML frontmatter.");
  }

  const endIndex = text.indexOf("\n---", 4);

  if (endIndex === -1) {
    throw new Error("Could not find closing YAML frontmatter delimiter.");
  }

  return {
    frontmatter: text.slice(4, endIndex).trim(),
    body: text.slice(endIndex + 4).trim(),
  };
}

function parseYamlScalar(value) {
  const trimmed = value.trim();

  if ((trimmed.startsWith("\"") && trimmed.endsWith("\"")) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function parseSimpleFrontmatter(frontmatterText) {
  const result = {};
  const lines = frontmatterText.split("\n");

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (!line.trim()) {
      continue;
    }

    const separatorIndex = line.indexOf(":");

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    if (value === "|" || value === "|-" || value === ">" || value === ">-") {
      const blockLines = [];
      let innerIndex = index + 1;

      while (innerIndex < lines.length) {
        const blockLine = lines[innerIndex];

        if (blockLine.startsWith("  ")) {
          blockLines.push(blockLine.slice(2));
          innerIndex += 1;
          continue;
        }

        if (!blockLine.trim()) {
          blockLines.push("");
          innerIndex += 1;
          continue;
        }

        break;
      }

      result[key] = blockLines.join("\n").trim();
      index = innerIndex - 1;
      continue;
    }

    result[key] = parseYamlScalar(value);
  }

  return result;
}

function deriveTitleFromFilename(filePath) {
  return path.basename(filePath, path.extname(filePath)).trim();
}

function stripSyncLog(body) {
  const markerIndex = body.indexOf("\n---");

  if (markerIndex === -1) {
    return body.trim();
  }

  return body.slice(0, markerIndex).trim();
}

function parseMemoryNote(text, filePath) {
  const { frontmatter, body } = splitFrontmatter(text);
  const metadata = parseSimpleFrontmatter(frontmatter);

  return {
    memoryId: metadata.id || "",
    title: metadata.title || deriveTitleFromFilename(filePath),
    content: metadata.content || metadata.text || stripSyncLog(body),
    memoryType: metadata.memory_type || metadata.type || "",
    domain: metadata.domain || "",
    sensitivity: metadata.sensitivity || "low",
    source: metadata.source || "manual_import",
    active: metadata.active,
    importance: metadata.importance,
    createdAt: metadata.created_at || metadata.created,
    updatedAt: metadata.updated_at || metadata.updated,
    lastUsedAt: metadata.last_used_at || "",
  };
}

function renderYamlScalar(value) {
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  const text = String(value ?? "");

  if (text === "" || /[:#\n]|^\s|\s$/.test(text)) {
    return JSON.stringify(text);
  }

  return text;
}

function updateFrontmatterValue(text, key, value) {
  const { frontmatter, body } = splitFrontmatter(text);
  const lines = frontmatter ? frontmatter.split("\n") : [];
  const renderedLine = `${key}: ${renderYamlScalar(value)}`;
  const lineIndex = lines.findIndex((line) => line.startsWith(`${key}:`));

  if (lineIndex === -1) {
    lines.push(renderedLine);
  } else {
    lines[lineIndex] = renderedLine;
  }

  return [
    "---",
    ...lines,
    "---",
    body,
  ].join("\n");
}

async function ensureMemoryNoteId(filePath) {
  const text = await fs.readFile(filePath, "utf8");
  const parsed = parseMemoryNote(text, filePath);

  if (parsed.memoryId) {
    return {
      ...parsed,
      sourcePath: filePath,
    };
  }

  const memoryId = crypto.randomUUID();
  const updatedText = updateFrontmatterValue(text, "id", memoryId);

  await fs.writeFile(filePath, updatedText, "utf8");

  return {
    ...parsed,
    memoryId,
    sourcePath: filePath,
  };
}

async function listMarkdownFiles(targetPath) {
  const stat = await fs.stat(targetPath);

  if (stat.isFile()) {
    return targetPath.endsWith(".md") ? [targetPath] : [];
  }

  const entries = await fs.readdir(targetPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const resolvedPath = path.join(targetPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...await listMarkdownFiles(resolvedPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(resolvedPath);
    }
  }

  return files;
}

async function loadMemoryRecordsFromPath(targetPath) {
  const files = await listMarkdownFiles(targetPath);
  const records = [];

  for (const filePath of files) {
    records.push(await ensureMemoryNoteId(filePath));
  }

  return records;
}

module.exports = {
  splitFrontmatter,
  parseSimpleFrontmatter,
  parseMemoryNote,
  updateFrontmatterValue,
  ensureMemoryNoteId,
  loadMemoryRecordsFromPath,
};
