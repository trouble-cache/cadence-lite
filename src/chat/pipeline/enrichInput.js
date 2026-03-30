const {
  getLlmClient,
  hasLlmApiKey,
  resolveImageModel,
  resolveTranscriptionModel,
} = require("../../llm/client");

function inferAudioFormat(attachment = {}, blob = null) {
  const contentType = String(attachment.contentType || blob?.type || "").toLowerCase();
  const name = String(attachment.name || "").toLowerCase();

  if (contentType.includes("ogg") || name.endsWith(".ogg")) {
    return "ogg";
  }

  if (contentType.includes("wav") || name.endsWith(".wav")) {
    return "wav";
  }

  if (contentType.includes("mpeg") || contentType.includes("mp3") || name.endsWith(".mp3")) {
    return "mp3";
  }

  if (contentType.includes("webm") || name.endsWith(".webm")) {
    return "webm";
  }

  return "ogg";
}

async function transcribeViaOpenRouter({ client, config, attachment, blob }) {
  const bytes = Buffer.from(await blob.arrayBuffer());
  const response = await client.chat.completions.create({
    model: resolveTranscriptionModel(config),
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Transcribe this audio faithfully. Return only the transcription text.",
          },
          {
            type: "input_audio",
            input_audio: {
              data: bytes.toString("base64"),
              format: inferAudioFormat(attachment, blob),
            },
          },
        ],
      },
    ],
  });

  return response.choices?.[0]?.message?.content?.trim() || "";
}

async function transcribeAudioAttachment({ client, config, attachment }) {
  const response = await fetch(attachment.url);

  if (!response.ok) {
    throw new Error(`Failed to fetch audio attachment (${response.status})`);
  }

  const blob = await response.blob();
  return transcribeViaOpenRouter({ client, config, attachment, blob });
}

async function analyzeImageAttachment({ client, config, attachment }) {
  const response = await client.responses.create({
    model: resolveImageModel(config),
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: [
              "Describe the attached image for downstream conversational context.",
              "Be concise but useful. Include visible text, the main subjects, and any emotionally relevant details.",
            ].join(" "),
          },
          {
            type: "input_image",
            image_url: attachment.url,
            detail: "auto",
          },
        ],
      },
    ],
  });

  return response.output_text?.trim() || "";
}

function buildDerivedAttachmentText(derivedAttachments) {
  if (!derivedAttachments.length) {
    return "";
  }

  return derivedAttachments
    .map((item) => {
      if (item.kind === "audio_transcription") {
        return `[Transcribed from voice note:]\n${item.text}`;
      }

      if (item.kind === "image_analysis") {
        return `[${item.authorName} attached an image. Description follows:]\n${item.text}`;
      }

      const label = item.attachment.name || `${item.kind} attachment`;
      return `${label}\n${item.text}`;
    })
    .join("\n\n");
}

async function enrichInput({ config, logger, input }) {
  if (!input.attachments.length) {
    return {
      ...input,
      derivedAttachments: [],
    };
  }

  const imageClient = hasLlmApiKey(config, "image") ? getLlmClient(config, "image") : null;
  const audioClient = hasLlmApiKey(config, "transcription") ? getLlmClient(config, "transcription") : null;
  const derivedAttachments = [];

  for (const attachment of input.attachments) {
    try {
      if (attachment.kind === "audio") {
        if (!audioClient) {
          logger.warn("[chat] Skipping audio transcription because no transcription-capable LLM API key is configured", {
            name: attachment.name,
          });
          continue;
        }

        logger.info("[chat] Transcribing audio attachment", {
          name: attachment.name,
          transcriptionModel: resolveTranscriptionModel(config),
        });

        const text = await transcribeAudioAttachment({ client: audioClient, config, attachment });

        if (text) {
          logger.debug("[chat] Audio transcription completed", {
            name: attachment.name,
            transcriptLength: text.length,
            transcriptPreview: text.slice(0, 160),
          });

          derivedAttachments.push({
            kind: "audio_transcription",
            attachment,
            authorName: input.authorName,
            text,
          });
        } else {
          logger.warn("[chat] Audio transcription returned empty text", {
            name: attachment.name,
          });
        }
      }

      if (attachment.kind === "image") {
        if (!imageClient) {
          logger.warn("[chat] Skipping image analysis because no LLM API key is configured", {
            name: attachment.name,
          });
          continue;
        }

        logger.info("[chat] Analysing image attachment", {
          name: attachment.name,
          imageModel: resolveImageModel(config),
        });

        const text = await analyzeImageAttachment({ client: imageClient, config, attachment });

        if (text) {
          derivedAttachments.push({
            kind: "image_analysis",
            attachment,
            authorName: input.authorName,
            text,
          });
        }
      }
    } catch (error) {
      logger.error("[chat] Failed to enrich attachment", {
        name: attachment.name,
        kind: attachment.kind,
        error: error.message,
      }, error);
    }
  }

  const derivedText = buildDerivedAttachmentText(derivedAttachments);
  const content = [input.content, derivedText].filter(Boolean).join("\n\n");
  const inputTypes = Array.from(
    new Set([
      ...input.inputTypes,
      ...derivedAttachments.map((item) => item.kind),
    ]),
  );

  return {
    ...input,
    content,
    inputTypes,
    derivedAttachments,
  };
}

module.exports = {
  analyzeImageAttachment,
  transcribeAudioAttachment,
  enrichInput,
};
