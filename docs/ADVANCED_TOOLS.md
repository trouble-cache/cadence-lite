# Advanced Tools

This page covers the local CLI tools bundled with Cadence Lite.

Most normal users do not need these. If you are deploying through Railway and using the admin UI, you can safely ignore this file unless you want extra maintenance or debugging tools.

## Before You Use These

Install dependencies first:

```bash
npm install
```

If you are running scripts locally, make sure your local environment has the same core variables your app needs, especially:

- `DATABASE_URL`
- `QDRANT_URL`
- `OPENROUTER_API_KEY`

## Discord Commands

Register slash commands:

```bash
npm run commands:register
```

## Conversation Tools

List recent stored conversations:

```bash
npm run conversations:list
```

Export a stored conversation:

```bash
npm run conversation:export -- <conversationId>
```

Useful export options:

- `--no-header`
- `--no-summaries`
- `--messages-only`
- `--limit=500`

## Memory Tools

Import markdown memory notes with frontmatter into Postgres:

```bash
npm run memories:import -- /path/to/memory-notes
```

Optionally override the user scope:

```bash
npm run memories:import -- /path/to/memory-notes --user-scope=georgia
```

List imported memory records:

```bash
npm run memories:list
```

Delete one or more memories from Postgres and Qdrant:

```bash
npm run memories:delete -- <memoryId> [more-memory-ids...]
```

Report most-used and never-used live memories:

```bash
npm run memories:usage -- --limit=10
```

List Qdrant points:

```bash
npm run memories:qdrant:list -- 20
```

Fetch specific Qdrant points by memory ID:

```bash
npm run memories:qdrant:get -- <memoryId> [more-memory-ids...]
```

Sync active Postgres memories into Qdrant:

```bash
npm run memories:sync
```

Reset the memory store and Qdrant collection:

```bash
npm run memories:reset -- --yes
```

This does not delete `conversation_events`.
