# Current Model Recommendations

*Last updated: 29 March 2026*
These are the current model recommendations for Cadence Lite via OpenRouter.

This file is intentionally separate from the main setup guide, because model availability, pricing, and relative quality can change over time.

## General advice

If you are not sure where to start, pick reliable, mainstream models first. You can always experiment later once the rest of your setup is working.

For most users, the best approach is:

- choose one dependable chat model
- choose one fast multimodal model for image analysis
- choose one embedding model and leave it alone
- choose one transcription model and only change it if needed

## Recommended defaults

### Image analysis
**Recommended default:** `google/gemini-2.5-flash`

Why:
- strong image understanding
- widely used on OpenRouter
- good fit for multimodal analysis workflows

### Embeddings
**Recommended default:** `openai/text-embedding-3-small`

Why:
- inexpensive
- straightforward
- strong default choice for memory retrieval

**Alternative:** `google/gemini-embedding-001`

Use this if you want to experiment with a newer embedding option, especially for multilingual or broader cross-domain retrieval.

### Audio transcription
**Recommended default:** `google/gemini-3.1-flash-lite-preview`

Why:
- supports audio input
- positioned as a high-efficiency model
- specifically described as improved for audio input / ASR

**Alternative:** `mistralai/voxtral-small-24b-2507`

Use this if you specifically want a model aimed at speech transcription, translation, and audio understanding.

## Important notes

### If you change embedding models later
If you switch to a different embeddings model after setup, rebuild your memory index.

Otherwise, your existing stored memories will still be indexed using the old embedding model, which can make retrieval inconsistent.

### Keep your first setup boring
For your very first deployment, boring is good.

Do not start by testing five different models at once. Get Cadence Lite working with one sensible set of defaults first, then swap things out one by one if you want to experiment.

## Suggested starter set

If you just want a working setup with minimal fuss, use:

- Chat: `openai/gpt-5.4`
- Image Analysis: `google/gemini-2.5-flash`
- Embeddings: `openai/text-embedding-3-small`
- Audio Transcription: `google/gemini-3.1-flash-lite-preview`