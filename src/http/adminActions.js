const { deleteMemoryEverywhere } = require("../memory/deleteMemories");
const { canSyncMemories, syncMemoriesToQdrant, syncMemoryToQdrant } = require("../memory/syncMemories");
const { deleteCollection, deletePoints } = require("../memory/qdrantClient");
const { applyRuntimeSettings, normalizeRuntimeSettings } = require("../config/runtimeSettings");
const { planSettingsSave } = require("../llm/modelValidation");
const { registerDiscordCommands } = require("../bot/registerCommands");
const { parseRequestForm, redirect } = require("./adminHttp");
const {
  DURABLE_MEMORY_TYPES,
  normalizeTheme,
  normalizeLiteAdminView,
  buildLiteAdminLocation,
  buildLiteMemoryExtras,
  buildLiteAutomationExtras,
} = require("./adminUi");

function buildMemoryImportRecords({ fields, files }) {
  const uploadedFile = files.file || files.memoriesFile;

  if (!uploadedFile?.content?.trim()) {
    throw new Error("Upload a Cadence memory export JSON file.");
  }

  let parsed;

  try {
    parsed = JSON.parse(uploadedFile.content);
  } catch (_error) {
    throw new Error("Memory import file must be valid JSON.");
  }

  const rawMemories = Array.isArray(parsed)
    ? parsed
    : (Array.isArray(parsed?.memories) ? parsed.memories : []);

  if (!rawMemories.length) {
    throw new Error("No memories were found in that import file.");
  }

  return rawMemories.map((memory) => ({
    memory_id: String(memory.memoryId || memory.memory_id || memory.id || "").trim() || undefined,
    title: String(memory.title || "").trim(),
    content: String(memory.content || memory.text || "").trim(),
    memory_type: String(memory.memoryType || memory.memory_type || "canon").trim().toLowerCase(),
    domain: String(memory.domain || "general").trim(),
    sensitivity: String(memory.sensitivity || "low").trim().toLowerCase(),
    source: String(memory.source || fields.importSource || "memory_import").trim() || "memory_import",
    active: memory.active !== false,
    reference_date: memory.referenceDate || memory.reference_date || "",
    created_at: memory.createdAt || memory.created_at || "",
    updated_at: memory.updatedAt || memory.updated_at || "",
  }));
}

function parseLiteMemoryForm(fields) {
  return {
    memoryId: String(fields.memoryId || "").trim(),
    title: String(fields.title || "").trim(),
    content: String(fields.content || "").trim(),
    memoryType: String(fields.memoryType || "").trim().toLowerCase(),
    domain: String(fields.domain || "").trim(),
    sensitivity: String(fields.sensitivity || "").trim().toLowerCase(),
  };
}

function parseLiteSettingsForm(fields) {
  return normalizeRuntimeSettings({
    "llm.chat.model": fields.chatModel,
    "llm.image.model": fields.imageModel,
    "llm.embedding.model": fields.embeddingModel,
    "llm.transcription.model": fields.transcriptionModel,
    "chat.historyLimit": fields.historyLimit,
    "chat.timezone": fields.chatTimezone,
    "chat.promptBlocks.personaName": fields.personaName,
    "chat.promptBlocks.userName": fields.userName,
    "chat.promptBlocks.personaProfile": fields.personaProfile,
    "chat.promptBlocks.toneGuidelines": fields.toneGuidelines,
    "chat.promptBlocks.userProfile": fields.userProfile,
    "chat.promptBlocks.companionPurpose": fields.companionPurpose,
    "chat.promptBlocks.boundaryRules": fields.boundaryRules,
  });
}

function parseLiteAutomationForm(fields) {
  const enabledState = String(fields.enabledState || "").trim().toLowerCase();

  return {
    automationId: String(fields.automationId || "").trim(),
    type: String(fields.type || "").trim().toLowerCase(),
    label: String(fields.label || "").trim(),
    channel_id: String(fields.channelId || "").trim(),
    schedule_time: String(fields.scheduleTime || "").trim(),
    prompt: String(fields.prompt || "").trim(),
    enabled: enabledState
      ? enabledState === "enabled"
      : (fields.enabled === "on" || fields.enabled === "true" || fields.enabled === "1"),
    mention_user: fields.mentionUser === "on" || fields.mentionUser === "true" || fields.mentionUser === "1",
    user_id: String(fields.userId || "").trim(),
  };
}

async function handleMemorySave(req, res, context) {
  const { fields } = await parseRequestForm(req);
  const theme = normalizeTheme(fields.theme);
  const view = normalizeLiteAdminView(fields.view);
  const submitted = parseLiteMemoryForm(fields);

  if (!DURABLE_MEMORY_TYPES.includes(submitted.memoryType)) {
    throw new Error(`Lite only supports durable memory types: ${DURABLE_MEMORY_TYPES.join(", ")}.`);
  }

  const existing = submitted.memoryId
    ? await context.memoryStore.getMemoryById(submitted.memoryId, {
      userScope: context.config.memory.userScope,
    })
    : null;

  const saved = await context.memoryStore.upsertMemory({
    memory_id: existing?.memoryId || undefined,
    title: submitted.title,
    content: submitted.content,
    memory_type: submitted.memoryType,
    domain: submitted.domain,
    sensitivity: submitted.sensitivity,
    importance: submitted.importance || undefined,
    source: existing?.source || "admin_ui",
    active: fields.restoreOnSave === "1" ? true : (existing?.active ?? true),
    created_at: existing?.createdAt,
  }, {
    userScope: context.config.memory.userScope,
  });

  let message = fields.restoreOnSave === "1"
    ? `Restored durable memory "${saved.title}".`
    : `Saved durable memory "${saved.title}".`;

  if (canSyncMemories(context.config)) {
    const syncResult = await syncMemoryToQdrant({
      config: context.config,
      memory: saved,
    });

    if (!syncResult.skipped) {
      message = fields.restoreOnSave === "1"
        ? `Restored durable memory "${saved.title}" and synced it to Qdrant.`
        : `Saved durable memory "${saved.title}" and synced it to Qdrant.`;
    }
  }

  redirect(res, buildLiteAdminLocation({
    view,
    message,
    theme,
    extra: buildLiteMemoryExtras({
      active: fields.active === "archived" ? "archived" : "active",
      q: fields.q,
      memoryType: fields.memoryTypeFilter,
      domain: fields.domainFilter,
      page: fields.page || 1,
    }),
  }));
}

async function handleMemoryImport(req, res, context) {
  const { fields, files } = await parseRequestForm(req);
  const theme = normalizeTheme(fields.theme);
  const view = normalizeLiteAdminView(fields.view);
  const records = buildMemoryImportRecords({ fields, files })
    .filter((record) => DURABLE_MEMORY_TYPES.includes(record.memory_type));

  if (!records.length) {
    throw new Error(`Import only supports durable memory types: ${DURABLE_MEMORY_TYPES.join(", ")}.`);
  }

  const importedMemories = [];

  for (const record of records) {
    const saved = await context.memoryStore.upsertMemory(record, {
      userScope: context.config.memory.userScope,
    });
    importedMemories.push(saved);
  }

  let message = `Imported ${importedMemories.length} durable ${importedMemories.length === 1 ? "memory" : "memories"}.`;

  if (canSyncMemories(context.config)) {
    const syncResult = await syncMemoriesToQdrant({
      config: context.config,
      memories: importedMemories,
    });

    if (!syncResult.skipped && syncResult.syncedCount > 0) {
      message = `Imported ${importedMemories.length} durable ${importedMemories.length === 1 ? "memory" : "memories"} and synced ${syncResult.syncedCount} to Qdrant.`;
    }
  }

  redirect(res, buildLiteAdminLocation({
    view,
    message,
    theme,
    extra: buildLiteMemoryExtras({
      active: fields.active === "archived" ? "archived" : "active",
      q: fields.q,
      memoryType: fields.memoryTypeFilter,
      domain: fields.domainFilter,
      page: fields.page || 1,
      sort: fields.sort || "updatedAt",
      direction: fields.direction || "desc",
    }),
  }));
}

async function handleMemoryArchive(req, res, context) {
  const { fields } = await parseRequestForm(req);
  const theme = normalizeTheme(fields.theme);
  const view = normalizeLiteAdminView(fields.view);
  const existing = await context.memoryStore.getMemoryById(fields.memoryId, {
    userScope: context.config.memory.userScope,
  });

  if (!existing) {
    redirect(res, buildLiteAdminLocation({
      view,
      error: "Memory not found.",
      theme,
    }));
    return;
  }

  const nextActiveState = existing.active ? false : true;
  const updated = await context.memoryStore.upsertMemory({
    memory_id: existing.memoryId,
    title: existing.title,
    content: existing.content,
    memory_type: existing.memoryType,
    domain: existing.domain,
    sensitivity: existing.sensitivity,
    importance: existing.importance,
    source: existing.source,
    active: nextActiveState,
    created_at: existing.createdAt,
  }, {
    userScope: context.config.memory.userScope,
  });

  if (context.config.qdrant?.url) {
    if (updated.active) {
      await syncMemoryToQdrant({
        config: context.config,
        memory: updated,
      });
    } else {
      await deletePoints({
        config: context.config,
        ids: [updated.memoryId],
      });
    }
  }

  redirect(res, buildLiteAdminLocation({
    view,
    message: `${updated.active ? "Restored" : "Archived"} durable memory "${updated.title}".`,
    theme,
    extra: buildLiteMemoryExtras({
      active: fields.active === "archived" ? "archived" : "active",
      q: fields.q,
      memoryType: fields.memoryTypeFilter,
      domain: fields.domainFilter,
      page: fields.page || 1,
    }),
  }));
}

async function handleMemoryDelete(req, res, context) {
  const { fields } = await parseRequestForm(req);
  const theme = normalizeTheme(fields.theme);
  const view = normalizeLiteAdminView(fields.view);
  const result = await deleteMemoryEverywhere({
    config: context.config,
    memoryStore: context.memoryStore,
    memoryId: fields.memoryId,
    userScope: context.config.memory.userScope,
  });

  redirect(res, buildLiteAdminLocation({
    view,
    message: result.deleted
      ? `Deleted durable memory "${result.memory.title}".`
      : "Nothing was deleted.",
    theme,
    extra: buildLiteMemoryExtras({
      active: fields.active === "archived" ? "archived" : "active",
      q: fields.q,
      memoryType: fields.memoryTypeFilter,
      domain: fields.domainFilter,
      page: fields.page || 1,
    }),
  }));
}

async function handleMemorySync(req, res, context) {
  const { fields } = await parseRequestForm(req);
  const theme = normalizeTheme(fields.theme);
  const view = normalizeLiteAdminView(fields.view);

  if (!canSyncMemories(context.config)) {
    redirect(res, buildLiteAdminLocation({
      view,
      error: "Qdrant sync needs QDRANT_URL and a working embeddings provider API key.",
      theme,
      extra: buildLiteMemoryExtras({
        active: fields.active === "archived" ? "archived" : "active",
        q: fields.q,
        memoryType: fields.memoryTypeFilter,
        domain: fields.domainFilter,
        page: fields.page || 1,
      }),
    }));
    return;
  }

  const memories = (await context.memoryStore.listMemories({
    userScope: context.config.memory.userScope,
    limit: 500,
    activeOnly: true,
  })).filter((memory) => DURABLE_MEMORY_TYPES.includes(memory.memoryType));

  const result = await syncMemoriesToQdrant({
    config: context.config,
    memories,
  });

  redirect(res, buildLiteAdminLocation({
    view,
    message: `Synced ${result.syncedCount} active durable memories to Qdrant.`,
    theme,
    extra: buildLiteMemoryExtras({
      active: fields.active === "archived" ? "archived" : "active",
      q: fields.q,
      memoryType: fields.memoryTypeFilter,
      domain: fields.domainFilter,
      page: fields.page || 1,
    }),
  }));
}

async function handleMemoryRebuild(req, res, context) {
  const { fields } = await parseRequestForm(req);
  const theme = normalizeTheme(fields.theme);
  const view = normalizeLiteAdminView(fields.view);

  if (!canSyncMemories(context.config)) {
    redirect(res, buildLiteAdminLocation({
      view,
      error: "Memory index rebuild needs QDRANT_URL and a working embeddings provider API key.",
      theme,
      extra: {
        active: "all",
        page: fields.page || 1,
      },
    }));
    return;
  }

  const memories = (await context.memoryStore.listMemories({
    userScope: context.config.memory.userScope,
    limit: 5000,
    activeOnly: true,
  })).filter((memory) => DURABLE_MEMORY_TYPES.includes(memory.memoryType));

  await deleteCollection({
    config: context.config,
  });

  const result = await syncMemoriesToQdrant({
    config: context.config,
    memories,
  });

  const message = result.syncedCount
    ? `Rebuilt the Qdrant memory index and resynced ${result.syncedCount} active durable memories.`
    : "Deleted the old Qdrant memory index. No active durable memories were available to resync.";

  redirect(res, buildLiteAdminLocation({
    view,
    message,
    theme,
    extra: {
      active: "all",
      page: fields.page || 1,
    },
  }));
}

async function handleSettingsSave(req, res, context) {
  const { fields } = await parseRequestForm(req);
  const theme = normalizeTheme(fields.theme);
  const view = normalizeLiteAdminView(fields.view);
  const settings = parseLiteSettingsForm(fields);
  const savePlan = await planSettingsSave({
    config: context.config,
    settings,
    fetchImpl: context.fetch || globalThis.fetch,
    logger: context.logger,
  });

  if (Object.keys(savePlan.settingsToPersist).length) {
    await context.settingsStore.upsertSettings(savePlan.settingsToPersist);
    applyRuntimeSettings(context.config, savePlan.settingsToPersist);
  }

  redirect(res, buildLiteAdminLocation({
    view,
    message: savePlan.successMessage,
    error: savePlan.errorMessage,
    theme,
    extra: {
      active: "all",
      page: fields.page || 1,
    },
  }));
}

async function handleAutomationSave(req, res, context) {
  const { fields } = await parseRequestForm(req);
  const theme = normalizeTheme(fields.theme);
  const view = normalizeLiteAdminView(fields.view);
  const submitted = parseLiteAutomationForm(fields);
  const isEditing = Boolean(submitted.automationId);

  const saved = await context.automationStore.upsertAutomation({
    automation_id: submitted.automationId || undefined,
    ...submitted,
  }, {
    userScope: context.config.memory.userScope,
    timezone: context.config.chat?.timezone || "UTC",
  });

  redirect(res, buildLiteAdminLocation({
    view,
    theme,
    message: `${isEditing ? "Saved" : "Added"} automation "${saved.label}".`,
  }));
}

async function handleAutomationDelete(req, res, context) {
  const { fields } = await parseRequestForm(req);
  const theme = normalizeTheme(fields.theme);
  const view = normalizeLiteAdminView(fields.view);
  const deleted = await context.automationStore.deleteAutomationById(fields.automationId, {
    userScope: context.config.memory.userScope,
  });

  redirect(res, buildLiteAdminLocation({
    view,
    theme,
    message: deleted
      ? `Deleted automation "${deleted.label}".`
      : "Nothing was deleted.",
  }));
}

async function handleAutomationToggle(req, res, context) {
  const { fields } = await parseRequestForm(req);
  const theme = normalizeTheme(fields.theme);
  const view = normalizeLiteAdminView(fields.view);
  const existing = await context.automationStore.getAutomationById(fields.automationId, {
    userScope: context.config.memory.userScope,
  });

  if (!existing) {
    redirect(res, buildLiteAdminLocation({
      view,
      theme,
      extra: buildLiteAutomationExtras({
        journalPage: fields.journalPage || 1,
      }),
      error: "Automation not found.",
    }));
    return;
  }

  const saved = await context.automationStore.upsertAutomation({
    automation_id: existing.automationId,
    type: existing.type,
    label: existing.label,
    channel_id: existing.channelId,
    schedule_time: existing.scheduleTime,
    timezone: existing.timezone,
    prompt: existing.prompt,
    enabled: !existing.enabled,
    mention_user: existing.mentionUser,
    user_id: existing.userId || "",
    last_run_at: existing.lastRunAt || "",
    last_error: existing.lastError || "",
  }, {
    userScope: context.config.memory.userScope,
  });

  redirect(res, buildLiteAdminLocation({
    view,
    theme,
    extra: buildLiteAutomationExtras({
      journalPage: fields.journalPage || 1,
    }),
    message: `${saved.enabled ? "Enabled" : "Paused"} automation "${saved.label}".`,
  }));
}

async function handleJournalDelete(req, res, context) {
  const { fields } = await parseRequestForm(req);
  const theme = normalizeTheme(fields.theme);
  const view = normalizeLiteAdminView(fields.view);
  const deleted = await context.journalStore.deleteEntryById(fields.entryId, {
    userScope: context.config.memory.userScope,
  });

  redirect(res, buildLiteAdminLocation({
    view,
    theme,
    extra: buildLiteAutomationExtras({
      journalPage: fields.journalPage || 1,
    }),
    message: deleted
      ? `Deleted journal entry "${deleted.title}".`
      : "Nothing was deleted.",
  }));
}

async function handleRegisterCommands(req, res, context) {
  const { fields } = await parseRequestForm(req);
  const theme = normalizeTheme(fields.theme);
  const view = normalizeLiteAdminView(fields.view);

  try {
    const result = await registerDiscordCommands({
      config: context.config,
      logger: context.logger,
    });

    redirect(res, buildLiteAdminLocation({
      view,
      theme,
      message: `Registered ${result.commandCount} Discord command${result.commandCount === 1 ? "" : "s"} for guild ${result.guildId}.`,
    }));
  } catch (error) {
    redirect(res, buildLiteAdminLocation({
      view,
      theme,
      error: error?.message || "Failed to register Discord commands.",
    }));
  }
}

async function handleConversationPrune(req, res, context) {
  const { fields } = await parseRequestForm(req);
  const theme = normalizeTheme(fields.theme);
  const view = normalizeLiteAdminView(fields.view);

  try {
    const result = await context.conversations.pruneEventsOlderThan({
      olderThanDays: Number(fields.olderThanDays || 0),
      guildId: context.config.discord.guildId || "",
    });

    redirect(res, buildLiteAdminLocation({
      view,
      theme,
      message: result.deletedCount > 0
        ? `Pruned ${result.deletedCount} stored conversation event${result.deletedCount === 1 ? "" : "s"} older than ${fields.olderThanDays} days.`
        : `No stored conversation events were older than ${fields.olderThanDays} days.`,
    }));
  } catch (error) {
    redirect(res, buildLiteAdminLocation({
      view,
      theme,
      error: error?.message || "Failed to prune stored conversations.",
    }));
  }
}

const ADMIN_POST_ACTIONS = Object.freeze({
  "/admin/actions/memory-save": handleMemorySave,
  "/admin/actions/memory-import": handleMemoryImport,
  "/admin/actions/memory-archive": handleMemoryArchive,
  "/admin/actions/memory-delete": handleMemoryDelete,
  "/admin/actions/memory-sync": handleMemorySync,
  "/admin/actions/memory-rebuild": handleMemoryRebuild,
  "/admin/actions/settings-save": handleSettingsSave,
  "/admin/actions/automation-save": handleAutomationSave,
  "/admin/actions/automation-delete": handleAutomationDelete,
  "/admin/actions/automation-toggle": handleAutomationToggle,
  "/admin/actions/journal-delete": handleJournalDelete,
  "/admin/actions/register-commands": handleRegisterCommands,
  "/admin/actions/conversation-prune": handleConversationPrune,
});

module.exports = {
  buildMemoryImportRecords,
  ADMIN_POST_ACTIONS,
};
