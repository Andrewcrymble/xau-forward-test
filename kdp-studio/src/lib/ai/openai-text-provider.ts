import type {
  BookConceptDraft,
  BookConceptRequest,
  BookPlanRequest,
  BookPlanResult,
  ListingDraft,
  ListingRequest,
  NicheCardDraft,
  NicheDiscoveryRequest,
  PageConceptDraft,
  TextAIProvider,
  TextUsage,
} from "./types";
import type { NicheSeriesIdea } from "@/lib/types";

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
            pageType: {
              type: "string",
              enum: ["standard", "colour_by_numbers"],
              description:
                "colour_by_numbers ONLY for concepts with bold enclosed shapes when the brief asks for some",
            },
            pageText: {
              type: ["string", "null"],
              description:
                "Text intentionally part of the artwork (e.g. 'Verse text — Reference (TRANSLATION)'), else null",
            },
          },
          required: ["title", "concept", "pageType", "pageText"],
        },
      },
    },
    required: ["concepts"],
  },
} as const;

function planSystemPrompt(): string {
  return [
    "You are an expert colouring-book art director for Amazon KDP publishers.",
    "You produce professionally art-directed lists of unique page concepts for a single cohesive colouring book — one collection, not unrelated images.",
    "Every concept must be a single self-contained scene suitable for one black-and-white line-art colouring page.",
    "Across the whole list, deliberately vary: composition, main subject, background, perspective/viewpoint, decorative elements, framing, foreground/background balance, and central versus asymmetrical layouts.",
    "Avoid duplicate subject matter, identical camera angles, repeated central compositions, the same background on every page, and slight variations of the same scene.",
    "Keep one consistent illustration style so the pages read as the SAME professionally illustrated book.",
    "Concepts must be family-friendly and appropriate for the stated audience.",
    "Do not mention colours or shading in concepts.",
    "When scripture is requested: NEVER invent, paraphrase or misattribute Bible verses. Choose well-known verses matching the requested themes, quote them in the requested translation to the best of your knowledge, always include the book chapter:verse reference, and never assign the same verse to two pages.",
  ].join(" ");
}

function planUserPrompt(req: BookPlanRequest, count: number): string {
  const parts = [
    `Create exactly ${count} unique colouring-page concepts for this book:`,
    `Main niche: ${req.niche}`,
  ];
  if (req.subNiche?.trim()) parts.push(`Sub-niche: ${req.subNiche.trim()}`);
  if (req.specificAngle?.trim())
    parts.push(`Specific theme / positioning angle: ${req.specificAngle.trim()}`);
  parts.push(
    `Target audience: ${req.audience}`,
    `Illustration style: ${req.style}`,
    `Line-art complexity: ${req.complexity}`,
  );
  if (req.tones?.trim()) parts.push(`Emotional tone of the whole book: ${req.tones.trim()}`);
  if (req.artworkTheme?.trim())
    parts.push(`Recurring imagery to draw from across the book: ${req.artworkTheme.trim()}`);
  if (req.creativeBrief?.trim())
    parts.push(`CREATIVE BRIEF for the whole book:\n${req.creativeBrief.trim()}`);
  if (req.description?.trim()) parts.push(`Extra notes from the author: ${req.description.trim()}`);
  if (req.bible) {
    parts.push(
      [
        `SCRIPTURE MODE: every page pairs its scene with a Bible verse.`,
        `Translation: ${req.bible.translation}.`,
        req.bible.themes.length > 0 ? `Verse themes: ${req.bible.themes.join(", ")}.` : "",
        req.bible.includeVerseText
          ? `Set pageText to the exact verse wording followed by " — Reference (${req.bible.translation})". If you are not certain of the exact wording, still provide your best text — every verse is flagged for human verification.`
          : `Set pageText to the scripture reference only, e.g. "Isaiah 40:31${req.bible.includeReference ? ` (${req.bible.translation})` : ""}".`,
        "Never use the same verse twice.",
      ]
        .filter(Boolean)
        .join(" "),
    );
  } else {
    parts.push("Set pageText to null for every concept — no text in the artwork.");
  }
  if (req.cbnCount && req.cbnCount > 0) {
    parts.push(
      `MIXED BOOK: exactly ${Math.min(req.cbnCount, count)} of the ${count} concepts must have pageType "colour_by_numbers" — choose the subjects that best suit large clearly-enclosed regions (stained glass, mosaics, flowers, landscapes, animals, mandalas, geometric designs, simple buildings, butterflies, birds, ornaments). The rest are "standard".`,
    );
  } else {
    parts.push(`Set pageType to "standard" for every concept.`);
  }
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

  /** One structured-output chat call, parsed as T. */
  private async jsonChat<T>(
    system: string,
    user: string,
    schema: object,
  ): Promise<{ data: T; tokens: number }> {
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
    return { data: JSON.parse(content) as T, tokens: json.usage?.total_tokens ?? 0 };
  }

  private async chat(
    system: string,
    user: string,
  ): Promise<{ concepts: PageConceptDraft[]; tokens: number }> {
    const { data, tokens } = await this.jsonChat<{ concepts: PageConceptDraft[] }>(
      system,
      user,
      CONCEPTS_SCHEMA,
    );
    return {
      concepts: (data.concepts ?? []).filter((c) => c.title && c.concept),
      tokens,
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

  async generateBookConcept(
    req: BookConceptRequest,
  ): Promise<{ concept: BookConceptDraft; usage: TextUsage }> {
    const schema = {
      name: "book_concept",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          creativeBrief: {
            type: "string",
            description:
              "4-8 sentence creative direction for the whole book: subject focus, emotional intent, visual themes, cohesion + variety guidance",
          },
          styleProfile: {
            type: "object",
            additionalProperties: false,
            properties: {
              lineThickness: { type: "string" },
              decorativeStyle: { type: "string" },
              characterStyle: { type: "string" },
              botanicalStyle: { type: "string" },
              landscapeStyle: { type: "string" },
              architecturalStyle: { type: "string" },
              framingStyle: { type: "string" },
              whiteSpace: { type: "string" },
              overallAesthetic: { type: "string" },
              recurringMotifs: { type: "array", items: { type: "string" } },
              levelOfDetail: { type: "string" },
            },
            required: [
              "lineThickness", "decorativeStyle", "characterStyle", "botanicalStyle",
              "landscapeStyle", "architecturalStyle", "framingStyle", "whiteSpace",
              "overallAesthetic", "recurringMotifs", "levelOfDetail",
            ],
          },
        },
        required: ["creativeBrief", "styleProfile"],
      },
    };
    const system = [
      "You are a senior art director creating the creative brief and persistent style profile for one professionally illustrated colouring book.",
      "The brief must communicate the book's positive emotional intent, its visual themes, and that the collection must feel cohesive while every page stays distinct.",
      "The style profile is short, concrete art direction (a phrase per field) that will be injected into EVERY image-generation prompt so all pages look like the same illustrator drew them.",
      "Fields that don't apply to this niche (e.g. architecturalStyle for a purely botanical book) should say how to handle that element IF it appears, not 'N/A'.",
    ].join(" ");
    const user = [
      `Main niche: ${req.niche}`,
      req.subNiche ? `Sub-niche: ${req.subNiche}` : "",
      req.specificAngle ? `Specific theme/angle: ${req.specificAngle}` : "",
      req.description ? `Author notes: ${req.description}` : "",
      `Target audience: ${req.audience}`,
      req.tones ? `Emotional tone: ${req.tones}` : "",
      req.artworkTheme ? `Recurring imagery requested: ${req.artworkTheme}` : "",
      `Illustration style: ${req.style}`,
      `Line-art complexity: ${req.complexity}`,
      `Book length: ${req.pageCount} colouring pages`,
      `Colouring mode: ${req.colouringMode}`,
    ]
      .filter(Boolean)
      .join("\n");
    const { data, tokens } = await this.jsonChat<BookConceptDraft>(system, user, schema);
    return {
      concept: data,
      usage: { provider: this.name, model: this.model, tokensUsed: tokens },
    };
  }

  async discoverNiches(
    req: NicheDiscoveryRequest,
  ): Promise<{ niches: NicheCardDraft[]; usage: TextUsage }> {
    const scoreProps = Object.fromEntries(
      [
        "specificity", "visualPotential", "variety", "audienceClarity",
        "giftPotential", "seriesPotential", "cbnSuitability", "overall",
      ].map((k) => [k, { type: "number", description: "1-10 concept score" }]),
    );
    const schema = {
      name: "niche_opportunities",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          niches: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                name: { type: "string", description: "Specific final niche name" },
                path: {
                  type: "array",
                  items: { type: "string" },
                  description:
                    "Logical niche tree path from broad to specific, e.g. ['Christian','Bible Verses','Hope','Hope During Difficult Seasons']",
                },
                audience: { type: "string" },
                concept: { type: "string", description: "2-3 sentence book concept" },
                artwork: { type: "string", description: "Suggested artwork direction" },
                bookType: {
                  type: "string",
                  enum: ["standard", "colour_by_numbers", "mixed"],
                },
                pageCount: { type: "number" },
                complexity: {
                  type: "string",
                  enum: ["very_simple", "simple", "medium", "detailed", "highly_detailed"],
                },
                difficulty: {
                  type: "string",
                  description: "How hard this book is to execute well, one short phrase",
                },
                positioning: {
                  type: "string",
                  description:
                    "One-sentence positioning statement: who it is for, what they colour, why they want it, what makes it different",
                },
                giftPotential: { type: "string", description: "One short phrase" },
                seriesPotential: { type: "string", description: "One short phrase" },
                scores: {
                  type: "object",
                  additionalProperties: false,
                  properties: scoreProps,
                  required: Object.keys(scoreProps),
                },
              },
              required: [
                "name", "path", "audience", "concept", "artwork", "bookType",
                "pageCount", "complexity", "difficulty", "positioning",
                "giftPotential", "seriesPotential", "scores",
              ],
            },
          },
        },
        required: ["niches"],
      },
    };
    const system = [
      "You are a KDP colouring-book niche strategist.",
      "You transform broad subjects into SPECIFIC, differentiated colouring-book concepts by building logical niche trees (broad topic → sub-topic → angle → audience → final niche).",
      "Each idea must be a genuinely distinct branch, not a rewording of another.",
      "A great niche pairs a clear customer with a concrete visual promise.",
      "All scores are your CONCEPT analysis only — you have NO Amazon market data, so never mention sales, search volume, BSR, competition counts or revenue.",
      "Never force crossover combinations that make no conceptual or commercial sense — prefer fewer, stronger ideas.",
    ].join(" ");
    const user = [
      `Broad topic: ${req.broadTopic}`,
      req.parentPath && req.parentPath.length > 0
        ? `GO DEEPER: narrow specifically within this existing path: ${req.parentPath.join(" → ")}. Every idea must extend this path further.`
        : "",
      req.combineWith?.trim()
        ? `CROSSOVER: combine the topic with "${req.combineWith.trim()}" — only combinations that genuinely work.`
        : "",
      req.market ? `Target market: ${req.market}` : "",
      req.audience ? `Audience preference: ${req.audience}` : "Audience: choose the best fit per idea.",
      req.bookType ? `Book type preference: ${req.bookType}` : "Book type: choose the best fit per idea.",
      `Produce exactly ${req.count} niche opportunities.`,
      req.avoidNames && req.avoidNames.length > 0
        ? `Do not duplicate these existing ideas: ${req.avoidNames.slice(0, 60).join("; ")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");
    const { data, tokens } = await this.jsonChat<{ niches: NicheCardDraft[] }>(
      system,
      user,
      schema,
    );
    return {
      niches: (data.niches ?? []).filter((n) => n.name),
      usage: { provider: this.name, model: this.model, tokensUsed: tokens },
    };
  }

  async generateNicheSeries(niche: {
    name: string;
    concept?: string | null;
    audience?: string | null;
  }): Promise<{ series: NicheSeriesIdea; usage: TextUsage }> {
    const schema = {
      name: "niche_series",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string", description: "Series name" },
          books: {
            type: "array",
            items: { type: "string" },
            description: "5-7 book titles, each targeting a related customer with clearly different content",
          },
        },
        required: ["name", "books"],
      },
    };
    const system =
      "You design colouring-book series for KDP publishers: one series name plus 5-7 sibling book titles that share the customer and aesthetic but have clearly different content, so a happy reader of one buys the next.";
    const user = [
      `Niche: ${niche.name}`,
      niche.concept ? `Concept: ${niche.concept}` : "",
      niche.audience ? `Audience: ${niche.audience}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    const { data, tokens } = await this.jsonChat<NicheSeriesIdea>(system, user, schema);
    return {
      series: data,
      usage: { provider: this.name, model: this.model, tokensUsed: tokens },
    };
  }
}
