<p align="center">
  <img src="https://github.com/trouble-cache/cadence-lite/blob/main/assets/cadence_logo_light.png" alt="Cadence Lite logo" width="120">
</p>

<h1 align="center">Cadence Lite</h1>

<p align="center">
  Private, editable, self-hosted AI companionship for Discord.
</p>

<p align="center">
  <a href="docs/LITE_SETUP_GUIDE.md">Setup Guide</a> ·
  <a href="docs/CURRENT_MODEL_RECS.md">Model Recommendations</a> ·
  <a href="docs/CONFIG_REFERENCE.md">Config Reference</a> ·
  <a href="docs/CHANGELOG.md">Changelog</a> ·
  <a href="SUPPORT.md">Support</a>
</p>

Cadence Lite is a private Discord-based AI companion you can deploy to your own Railway account.

It’s for people who want a companion that feels personal, editable, and genuinely theirs — not a sealed platform where memory is opaque, behaviour is fixed, and the important parts happen somewhere out of reach. Cadence Lite keeps the system closer to you: your Discord server, your admin panel, your stored memories, your model choices.

The result is a lightweight self-hosted companion setup with durable memory, OpenRouter-based chat, multimodal support, and a small set of practical automations.

## Licence

This repo is published under [PolyForm Noncommercial 1.0.0](LICENSE).

In plain English: you can use, study, and adapt Cadence Lite for noncommercial purposes, but you cannot repackage or sell it commercially without permission.

## Who it’s for

Cadence Lite is a good fit if you want:

- a private AI companion in your own Discord space
- persistent memory you can actually review, edit, export, and manage
- flexibility over which models you use
- a setup that feels personal without locking you into one platform
- a lighter, simpler starting point than the broader Cadence Core workspace

## Who it’s not for

Cadence Lite is not intended for public servers, large shared spaces, or plug-and-play mass deployment.

It works best as a private setup, because it can recall stored personal context and responds to normal messages by default. In the wrong environment, that can become noisy, intrusive, or simply too revealing.

It’s also self-hosted. If you want a fully managed hosted product, this is not that.

## What it can do

Cadence Lite includes:

- OpenRouter-based chat
- editable durable memories
- a built-in admin panel
- retrieval-backed memory with Qdrant
- image analysis
- audio transcription
- web search
- simple scheduled check-ins and journals

## Start here

If you want the step-by-step setup guide, start with:

- [Human Setup Guide](docs/LITE_SETUP_GUIDE.md)

If you want the current recommended starter models, see:

- [Current Model Recommendations](docs/CURRENT_MODEL_RECS.md)

If you want the configuration and technical reference, see:

- [Configuration Reference](docs/CONFIG_REFERENCE.md)

If you want a running note of meaningful post-release fixes and behaviour changes, see:

- [Changelog](docs/CHANGELOG.md)

If you want local scripts and maintenance tools, see:

- [Advanced Tools](docs/ADVANCED_TOOLS.md)

If you need bug-report guidance or want to know what support is currently offered, see:

- [Support](SUPPORT.md)

## Lite vs Core

`Cadence Lite`: The free, simpler entry point
- durable fact-file memories only; it does not save broader long-term memories beyond that
- daily schedules - check-in messages and journals
- ability to send you AI images and voice notes via discord
- OpenRouter support so you can switch models whenever you want
- export tools to keep your data with you, always

`Cadence Core`: The paid product, main development focus moving forward
- broader long-term memory systems
- proactive "Metronome" actions
- daily and weekly scheduling
- optional modules included: gif messages, image generation
- more advanced memory tools and automations

Smaller Core features and quality-of-life improvements may still make their way into Lite over time, but this will always remain the lighter, free version.

[Buy Cadence Core](https://www.patreon.com/posts/cadence-private-156169435)
