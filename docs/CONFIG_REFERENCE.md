# Configuration Reference

This page is the slightly grim machinery reference for Cadence Lite.

If you are deploying through the Railway template and just want the setup flow, use [docs/LITE_SETUP_GUIDE.md](LITE_SETUP_GUIDE.md) instead.

## Core Product Truths

- Cadence Lite is OpenRouter-only.
- The main LLM key is `OPENROUTER_API_KEY`.
- Most people using the Railway template only need to supply a small set of user-facing variables.

## Required User-Supplied Values

These are the values a normal user needs to provide when deploying from the template:

- `ADMIN_SECRET`
- `DISCORD_TOKEN`
- `DISCORD_CLIENT_ID`
- `DISCORD_GUILD_ID`
- `OPENROUTER_API_KEY`

If you are deploying somewhere other than Railway, start from `.env.example`. The app still expects the same core variables; Railway simply pre-fills more of the database and service wiring for you.

## Usually Prefilled By The Railway Template

These are typically already wired up by the template:

- `DATABASE_URL`
- `QDRANT_URL`
- `QDRANT_COLLECTION`
- `MEMORY_USER_SCOPE`

Depending on the template shape, the internal Postgres service may also carry its own Railway service variables separately. Most users should not need to touch those.

## Discord Runtime Settings

- `DISCORD_TOKEN`
  Bot token used to log into Discord.

- `DISCORD_CLIENT_ID`
  Discord application ID used when registering slash commands.

- `DISCORD_GUILD_ID`
  Discord server ID used for guild command registration.

- `DISCORD_RESPOND_TO_MENTIONS_ONLY`
  Optional safety flag. If `true`, Cadence only responds when mentioned.

## Admin And App Runtime

- `ADMIN_SECRET`
  Enables the admin UI and acts as the HTTP Basic auth password.

- `LOG_LEVEL`
  Logging level such as `info` or `debug`.

- `PORT`
  App port. Railway usually provides this automatically.

## OpenRouter Settings

- `OPENROUTER_API_KEY`
  Required. The main API key for chat, images, embeddings, and transcription.

- `OPENROUTER_BASE_URL`
  Optional. Defaults to `https://openrouter.ai/api/v1`.

- `OPENROUTER_HTTP_REFERER`
  Optional app attribution URL for OpenRouter.

- `OPENROUTER_APP_TITLE`
  Optional app attribution title. Defaults to `Cadence Lite`.

## Model Defaults

Cadence Lite lets you set different OpenRouter model slugs for different jobs:

- `CHAT_LLM_MODEL`
- `IMAGE_LLM_MODEL`
- `EMBEDDING_LLM_MODEL`
- `TRANSCRIPTION_LLM_MODEL`

There are also legacy-compatible env names still accepted for chat and image:

- `LLM_CHAT_MODEL`
- `LLM_IMAGE_MODEL`

Current built-in defaults from `src/config/env.js`:

- chat: `openai/gpt-5.4`
- image: `openai/gpt-5.4-mini`
- embeddings: `openai/text-embedding-3-small`
- transcription: `google/gemini-2.5-flash`

## Prompt And Chat Defaults

These can all be managed in the admin UI after first boot, but env vars still work as startup defaults:

- `CHAT_PROMPT_PERSONA_NAME`
- `CHAT_PROMPT_USER_NAME`
- `CHAT_PROMPT_PERSONA_PROFILE`
- `CHAT_PROMPT_TONE_GUIDELINES`
- `CHAT_PROMPT_USER_PROFILE`
- `CHAT_PROMPT_COMPANION_PURPOSE`
- `CHAT_PROMPT_BOUNDARY_RULES`
- `CHAT_HISTORY_LIMIT`
- `CHAT_INCLUDE_TIME_CONTEXT`
- `CHAT_TIMEZONE`

Notes:

- `CHAT_HISTORY_LIMIT` is clamped to a maximum of `50`.
- `CHAT_TIMEZONE` defaults to `UTC`.
- The default timezone is also used for automations unless you later change the product behaviour again.

## Persistence And Memory Settings

- `DATABASE_URL`
  Postgres connection string.

- `QDRANT_URL`
  Qdrant service URL.

- `QDRANT_API_KEY`
  Optional Qdrant API key. Often blank for internal Railway service use.

- `QDRANT_COLLECTION`
  Collection name used for memory retrieval. Defaults to `cadence-memory`.

- `MEMORY_USER_SCOPE`
  Default user scope for stored memories.

## Embedding Model Note

If you change the embeddings model after setup, rebuild the memory index.

That rebuilds the Qdrant collection using the current embedding model and resyncs stored memories from Postgres. It does not delete the source memories in Postgres.
