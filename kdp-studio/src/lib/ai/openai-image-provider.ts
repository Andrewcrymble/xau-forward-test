import type {
  GeneratedImage,
  ImageAIProvider,
  ImageGenerationRequest,
} from "./types";

// OpenAI image provider. One API request generates exactly ONE colouring
// page. Supports gpt-image-1 (default) and dall-e-3; both are asked for
// their tallest portrait size and the result is normalised to the
// 2550×3300 print canvas afterwards.

const DEFAULT_MODEL = "gpt-image-1";

/** Portrait size per model (the closest each offers to US Letter). */
const PORTRAIT_SIZE: Record<string, string> = {
  "gpt-image-1": "1024x1536",
  "dall-e-3": "1024x1792",
};

/** Estimated USD cost per single portrait image, by model and quality. */
const ESTIMATED_COST: Record<string, Record<string, number>> = {
  "gpt-image-1": { low: 0.016, medium: 0.063, high: 0.25 },
  "dall-e-3": { standard: 0.08, hd: 0.12 },
};

export class OpenAIImageProvider implements ImageAIProvider {
  readonly name = "openai";
  private apiKey: string;
  private model: string;
  private quality: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.model = process.env.OPENAI_IMAGE_MODEL || DEFAULT_MODEL;
    this.quality =
      process.env.OPENAI_IMAGE_QUALITY ||
      (this.model === "dall-e-3" ? "standard" : "medium");
  }

  async generateImage(req: ImageGenerationRequest): Promise<GeneratedImage> {
    const size = PORTRAIT_SIZE[this.model] ?? "1024x1536";
    const body: Record<string, unknown> = {
      model: this.model,
      prompt: req.prompt,
      n: 1,
      size,
      quality: this.quality,
    };
    // gpt-image-1 always returns base64; dall-e-3 needs to be asked.
    if (this.model === "dall-e-3") body.response_format = "b64_json";

    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      let detail = text.slice(0, 300);
      try {
        detail = (JSON.parse(text) as { error?: { message?: string } }).error
          ?.message ?? detail;
      } catch {
        // keep raw text
      }
      throw new Error(`OpenAI image request failed (${res.status}): ${detail}`);
    }
    const json = (await res.json()) as { data?: { b64_json?: string }[] };
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) throw new Error("OpenAI returned no image data");

    return {
      data: Buffer.from(b64, "base64"),
      contentType: "image/png",
      provider: this.name,
      model: this.model,
      estimatedCost: ESTIMATED_COST[this.model]?.[this.quality],
    };
  }
}
