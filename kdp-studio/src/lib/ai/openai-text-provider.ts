import type {
  BookPlanRequest,
  BookPlanResult,
  ListingDraft,
  ListingRequest,
  PageConceptDraft,
  TextAIProvider,
  TextUsage,
} from "./types";

// OpenAI text provider. Uses the Chat Completions API with a JSON schema
// response format so results parse reliably. Server-side only.

const DEFAULT_MODEL = "gpt-4o-mini";
const MAX_TOPUP_ATTEMPTS = 3;

interface ChatUsage {
  total_tokens?: number;
}

const CONCEPTS_SCHEMA = {
  name: "page_concepts",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      concepts: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string", description: "Short page title, max ~8 words" },
            concept: {
              type: "string",
              description:
                "1–3 sentence description of the scene: subject, setting, composition/viewpoint",
            },
          },
          required: ["title", "concept"],
        },
      },
    },
    required: ["concepts"],
  },
} as const;

function planSystemPrompt(): string {
  return [
    "You are an expert colouring-book planner for Amazon KDP publishers.",
    "You produce lists of unique page concepts for a single colouring book.",
    "Every concept must be a single self-contained scene suitable for one black-and-white line-art colouring page.",
    "Across the whole list, avoid: duplicate subject matter, identical camera angles, repeated central compositions, the same background on every page, and highly repetitive layouts.",
    "Vary viewpoints, framing and settings while keeping one consistent illustration style.",
    "Concepts must be family-friendly and appropriate for the stated audience.",
    "Do not mention colours, shading, text or captions in concepts.",
  ].join(" ");
}

function planUserPrompt(req: BookPlanRequest, count: number): string {
  const parts = [
    `Create exactly ${count} unique colouring-page concepts for this book:`,
    `Niche/topic: ${req.niche}`,
    `Target audience: ${req.audience}`,
    `Illustration style: ${req.style}`,
    `Line-art complexity: ${req.complexity}`,
  ];
  if (req.description?.trim()) parts.push(`Extra notes from the author: ${req.description.trim()}`);
  if (req.avoidTitles && req.avoidTitles.length > 0) {
    parts.push(
      "Do NOT duplicate or closely resemble any of these existing pages: " +
        req.avoidTitles.join("; "),
    );
  }
  return parts.join("\n");
}

export class OpenAITextProvider implements TextAIProvider {
  readonly name = "openai";
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model?: string) {
    this.apiKey = apiKey;
    this.model = model || process.env.OPENAI_TEXT_MODEL || DEFAULT_MODEL;
  }

  private async chat(
    system: string,
    user: string,
  ): Promise<{ concepts: PageConceptDraft[]; tokens: number }> {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_schema", json_schema: CONCEPTS_SCHEMA },
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`OpenAI request failed (${res.status}): ${text.slice(0, 300)}`);
    }
    const json = (await res.json()) as {
      choices: { message: { content: string } }[];
      usage?: ChatUsage;
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenAI returned an empty response");
    const parsed = JSON.parse(content) as { concepts: PageConceptDraft[] };
    return {
      concepts: (parsed.concepts ?? []).filter((c) => c.title && c.concept),
      tokens: json.usage?.total_tokens ?? 0,
    };
  }

  async generateBookPlan(req: BookPlanRequest): Promise<BookPlanResult> {
    const collected: PageConceptDraft[] = [];
    const seen = new Set((req.avoidTitles ?? []).map((t) => t.toLowerCase()));
    let tokens = 0;

    // The model sometimes returns fewer items than asked; top up until we
    // have enough or attempts run out.
    for (let attempt = 0; attempt < MAX_TOPUP_ATTEMPTS && collected.length < req.count; attempt++) {
      const remaining = req.count - collected.length;
      const { concepts, tokens: t } = await this.chat(
        planSystemPrompt(),
        planUserPrompt(
          { ...req, avoidTitles: [...seen] },
          remaining,
        ),
      );
      tokens += t;
      for (const c of concepts) {
        const key = c.title.toLowerCase();
        if (!seen.has(key) && collected.length < req.count) {
          seen.add(key);
          collected.push(c);
        }
      }
    }

    if (collected.length === 0) {
      throw new Error("The AI did not return any usable page concepts");
    }

    const usage: TextUsage = { provider: this.name, model: this.model, tokensUsed: tokens };
    return { concepts: collected, usage };
  }

  async generateReplacementConcept(req: Omit<BookPlanRequest, "count">) {
    const { concepts, usage } = await this.generateBookPlan({ ...req, count: 1 });
    return { concept: concepts[0], usage };
  }

  async generateListing(
    req: ListingRequest,
  ): Promise<{ listing: ListingDraft; usage: TextUsage }> {
    const system = [
      "You are an expert Amazon KDP listing copywriter for colouring books.",
      "Write compelling, honest sales copy. Never promise Amazon rankings, bestseller status or sales results.",
      "Keywords are backend search terms: 2-3 words each, no punctuation, no duplicates of the title words where avoidable, exactly 7 of them.",
      "The Amazon title must be under 200 characters; the description 600-1500 characters, written as flowing paragraphs (plain text, no markdown).",
      "The back-cover description is 2-4 short sentences suitable for print.",
      "The short promo is a single sentence for ads/social.",
    ].join(" ");
    const user = [
      `Book title: ${req.bookTitle}`,
      req.subtitle ? `Subtitle: ${req.subtitle}` : "",
      req.author ? `Author: ${req.author}` : "",
      `Niche: ${req.niche}`,
      req.description?.trim() ? `Author notes: ${req.description.trim()}` : "",
      `Audience: ${req.audience}`,
      `Illustration style: ${req.style}`,
      `Number of colouring pages: ${req.pageCount}`,
      req.pageTitles.length > 0
        ? `Example pages: ${req.pageTitles.slice(0, 15).join("; ")}`
        : "",
      "Produce: 4 title suggestions, a recommended title and subtitle, the product description, 4-6 bullet-style sales points, exactly 7 keywords, a one-sentence audience description, a back-cover description, and a short promotional sentence.",
    ]
      .filter(Boolean)
      .join("\n");

    const schema = {
      name: "amazon_listing",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          titleSuggestions: { type: "array", items: { type: "string" } },
          title: { type: "string" },
          subtitle: { type: "string" },
          description: { type: "string" },
          bulletPoints: { type: "array", items: { type: "string" } },
          keywords: { type: "array", items: { type: "string" } },
          audience: { type: "string" },
          backCoverDescription: { type: "string" },
          shortPromo: { type: "string" },
        },
        required: [
          "titleSuggestions", "title", "subtitle", "description",
          "bulletPoints", "keywords", "audience", "backCoverDescription", "shortPromo",
        ],
      },
    };

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_schema", json_schema: schema },
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`OpenAI request failed (${res.status}): ${text.slice(0, 300)}`);
    }
    const json = (await res.json()) as {
      choices: { message: { content: string } }[];
      usage?: ChatUsage;
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenAI returned an empty response");
    const listing = JSON.parse(content) as ListingDraft;
    // Enforce exactly seven keywords regardless of what the model returned.
    listing.keywords = listing.keywords.filter(Boolean).slice(0, 7);
    while (listing.keywords.length < 7) {
      listing.keywords.push(`${listing.keywords.length + 1} colouring book`);
    }
    return {
      listing,
      usage: {
        provider: this.name,
        model: this.model,
        tokensUsed: json.usage?.total_tokens ?? 0,
      },
    };
  }
}
