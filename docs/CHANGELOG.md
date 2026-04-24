# Changelog

Short notes on meaningful internal changes to Cadence Lite.

## 2026-04-24

### Model validation on save

- Added OpenRouter-backed model validation for changed Lite model settings using the current key's `/models/user` view.
- Settings saves are now planned before persistence:
  valid model changes save normally,
  invalid model changes are rejected,
  and non-model settings from the same form still save.
- If OpenRouter model validation cannot be completed, Lite now saves the settings anyway and shows a warning instead of blocking the whole form.
- Added a small admin UI note explaining that changed model slugs are checked against the models available to the current OpenRouter key where possible.

### Discord diagnostics

- Added explicit logs for silently ignored Discord messages that arrive as DMs.
- Added explicit logs for messages skipped because mention-only mode is enabled and the bot was not mentioned.
- Startup logs now include whether `DISCORD_RESPOND_TO_MENTIONS_ONLY` is enabled, which makes support debugging much less guessy.

### Conversation exports

- Added bulk conversation export tools to the Lite admin UI.
- Lite now supports a flat CSV export of stored conversation events via `GET /admin/exports/conversation-events.csv`.
- Lite now supports a ZIP export of readable per-conversation text logs via `GET /admin/exports/conversation-logs`.
- The ZIP export includes `logs/*.txt`, `index.csv`, and `metadata.json`, and keeps the existing single-conversation CLI export working.

### Admin HTTP tidy-up

- Split Lite admin HTTP concerns into smaller modules instead of keeping everything inside `createHealthServer.js`.
- Extracted admin export streaming into `src/http/adminExports.js`.
- Extracted auth, redirects, and multipart/form parsing into `src/http/adminHttp.js`.
- Extracted admin UI rendering helpers into `src/http/adminUi.js`.
- Extracted admin POST action handlers into `src/http/adminActions.js`.
- Extracted admin page data loading and filtering into `src/http/adminPageData.js`.

### Sidebar footer and docs link

- Added a small sidebar footer block with `Help Docs` and `Support Cadence` links.
- Added Lite-specific sidebar footer styling and themed `help` / `patreon` icons.
- Added a docs download route for `docs/Cadence Lite Setup Guide.pdf`.
- Added a visible sidebar version label: `Cadence Lite v 1.02`.
- Changed the main `Cadence Lite` sidebar logo link so it now returns users to the Lite dashboard home instead of linking out to Patreon.

## 2026-04-08

### Journal slices

- Fixed journal excerpt selection so long conversations no longer always bias toward the final stretch of the thread.
- Journal automations now pick a random contiguous window inside long candidate conversations instead of always taking the latest messages.
- Journal memory retrieval now aligns to the same selected slice:
  the latest user message in the slice is used as the primary anchor, and earlier user messages from that slice become the continuity context.

### Memory retrieval resilience

- Added embedding response validation in `src/memory/embeddings.js`.
- If the embedding provider returns a malformed response without a `data` array, Lite now throws a clear error instead of crashing on `.sort()`.
- Chat pipeline memory retrieval is now wrapped in `try/catch`, so replies continue with `memories = []` if retrieval fails.
- Scheduled automations now apply the same fallback so memory failures do not kill check-ins or journal runs.

## 2026-04-05

### Chat history shaping

- Stopped flattening recent history, memory context, and the current message into one large synthetic user blob.
- Lite now sends:
  prior turns as structured messages,
  a separate background context message for memories and extra context,
  and the latest user message as the final user turn.
- Ordinary prior turns are now sent as raw text instead of `Name: text` transcript lines.
- Special history items such as proactive or non-message events keep explicit labels when those markers are useful.

### Conversation scoping

- Recent chat history now prefers stored conversation events scoped by `conversation_id`.
- Conversation scope prefers thread ID over channel ID, preventing parent-channel bleed.
- Memory retrieval now uses the same conversation-scoped recent history source as the chat pipeline.

### Continuity window

- Fixed recent-history loading so it uses the latest stored slice instead of the oldest stored slice.
- Memory continuity context now uses a trailing user-context snippet capped at 300 characters, rather than pulling in arbitrary old full messages.

## 2026-04-04

### History limits

- Pinned the default recent-history window to 20 instead of allowing fallback drift to 8 in lower layers.
- Added tests to keep the configured `chat.historyLimit` path and the 20-message default pinned.
