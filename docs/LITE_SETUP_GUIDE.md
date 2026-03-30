# Cadence Lite Setup Guide

Cadence Lite is a private Discord-based companion setup you can deploy to your own Railway account.

This guide walks you through the basic setup:

- Create a private Discord server
- Create a Discord bot and invite it
- Get an OpenRouter API key
- Deploy the Railway template
- Configure Cadence Lite in the admin panel
- Register Discord commands
- Test chat, memories, and media features

## Before you begin

You will need:

- A Discord account
- A Railway account
- An OpenRouter account
- A private Discord server for testing

## 1. Create a private Discord server

If you do not already have one, create a new Discord server just for Cadence Lite testing.

This is strongly recommended. Cadence Lite is designed for private use, and you should avoid deploying it into shared servers unless you fully understand the risks.

## 2. Create a Discord bot

1. Go to the Discord Developer Portal.
2. Create a new application.
3. Add a bot to the application.
4. Under `Bot`, enable `Message Content Intent`.
5. Keep the bot private.
6. Under `OAuth2 > URL Generator`, generate an invite link for your private server using:
   - `bot`
   - `applications.commands`

While setting up your bot, collect and note down these values:

- `Application ID`
- `Bot Token`

## 3. Get an OpenRouter API key

Create an API key in OpenRouter and keep it noted down.

## 4. Deploy the Railway template

1. Open the Cadence Lite Railway template link.
   https://railway.com/deploy/O6_eJ0?referralCode=y3ulQC
2. Scroll down to the `cadence-lite` service card.
3. Click **Configure**.

Add the following environment variables:

- `ADMIN_SECRET` — choose your own admin password
- `DISCORD_TOKEN` — use the bot token for your Discord bot
- `DISCORD_CLIENT_ID` — use the application ID for your Discord bot
- `DISCORD_GUILD_ID` — use the server ID for your private Discord server
- `OPENROUTER_API_KEY` — paste your OpenRouter API key here

Save the configuration, then deploy.

Wait for the services to finish building.

## 5. Open the Cadence admin panel

1. In Railway, click the `cadence-lite` service card.
2. Copy the public app URL.
3. Visit that URL in your browser.
4. Click `Open Admin`.
5. Log in using:
   - any username
   - your `ADMIN_SECRET` as the password

## 6. Configure your Cadence settings

In the admin panel:

### Identity and preferences

Fill in any identity details you want. All identity fields are optional.

You can also set:

- Recent chat context size
- Default timezone

Save your settings.

### Models

In the model settings, enter the full OpenRouter model slugs you want to use for:

- Chat — your preferred chat model
- Image Analysis — must support image input  
- Embeddings — must be suitable for text embeddings.
   - As a sensible starting point, choose a smaller model in roughly the 1000–1700 dimension range, such as openai/text-embedding-3-small or baai/bge-m3.
- Audio Transcription — must support audio input  

Save again after updating the model settings.

## 7. Register Discord commands

Scroll down and click:

**Register Discord Commands**

Then go back to Discord and test that slash commands are available by typing:

`/ping`

Your bot should respond with `pong`.

## 8. Set up memory

If you already have a valid Cadence memory export in JSON format, you can import it now.

If you are starting fresh:

1. Open the Memories screen
2. Create and save one memory manually

This first memory matters because it gives Cadence something to index before you begin chatting. Chat inputs will not work until you have at least one memory saved, even if it is just a dummy entry.

You can always add or import more memories later.

## 9. Send a test message

Once you have at least one memory saved, go to Discord and send a test message in your server.

Your AI should reply naturally.

## 10. Test the features you plan to use

Depending on your setup, you may also want to test:

- Image input
- Voice input
- Web search

## Important note on privacy and server use

Cadence Lite is designed for private Discord use.

It does not include the kind of hardened safety controls you would want for a shared or public multi-user environment. That means the bot may surface personal or sensitive information in ways that are acceptable in a private server, but not appropriate in a shared one.

Your AI will also respond to every message in the server without needing to be tagged. In a shared server, this can quickly become noisy and may also increase your usage costs.

If you deploy Cadence Lite outside a private server, you do so at your own risk.
