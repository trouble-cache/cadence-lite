# Architecture

This is the technical overview for Cadence Lite.

It is not required for deployment, but it is useful if you want to understand what the app is actually doing under the hood.

## High-Level Shape

Cadence Lite has four main pieces:

- Discord for the live chat surface
- the admin UI for settings, memories, and automations
- Postgres for durable storage
- Qdrant for memory retrieval

## Discord Flow

At runtime, Cadence Lite connects to Discord as a bot.

Incoming messages are:

- normalised
- optionally enriched with image or audio processing
- combined with recent history
- matched against retrieved memories
- sent to OpenRouter for the final reply

Replies are then written back to Discord and persisted into Postgres.

## Admin Flow

The built-in admin UI lives at `/admin`.

It uses HTTP Basic auth with:

- any username
- `ADMIN_SECRET` as the password

The admin UI handles:

- identity and prompt settings
- model slugs
- default timezone and chat history settings
- memory import/export
- memory rebuild
- Discord command registration
- conversation pruning
- automations and journal cleanup

Saved settings are persisted in Postgres and applied back to the live runtime config.

## Postgres

Postgres is the durable source of truth for:

- memories
- conversation events
- automations
- journal entries
- saved runtime settings

If something needs to be edited, reviewed, exported, or restored, Postgres is the place Cadence Lite trusts first.

## Qdrant

Qdrant is not the source of truth.

It is the retrieval index used for memory search. Cadence Lite stores embedded memory vectors there so it can fetch relevant memories quickly during chat.

In practice:

- Postgres holds the real memory records
- Qdrant holds the vectors used to retrieve them

If the embedding model changes, the Qdrant index must be rebuilt so the vectors all live in the same embedding space.

## Memory Lifecycle

1. A memory is created or imported.
2. The durable record is stored in Postgres.
3. The memory is embedded and synced into Qdrant.
4. During chat, Cadence Lite embeds the user query and searches Qdrant.
5. Matching memories are hydrated back from Postgres and injected into the prompt.

## Automations

Automations are stored in Postgres and checked by the app runtime.

Cadence Lite currently supports:

- daily check-ins
- daily journals

They use the app’s default timezone from settings and post into the configured Discord channel.

## Why The Split Matters

The Postgres/Qdrant split is what makes Lite feel manageable:

- you can edit memories cleanly in Postgres-backed admin flows
- you still get fast retrieval through Qdrant
- you can rebuild the index without losing the source memories

That is also why `Rebuild Memory Index` exists. It is there to repair or regenerate the retrieval layer, not to rewrite your actual stored memories.
