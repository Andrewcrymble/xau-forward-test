import { z } from "zod";
import {
  BIBLE_TRANSLATIONS,
  CBN_COLOUR_COUNTS,
  CBN_DIFFICULTIES,
  CBN_KEY_PLACEMENTS,
  COMPLEXITY_LEVELS,
  EMOTIONAL_TONES,
  MAX_PAGE_COUNT,
  MIN_PAGE_COUNT,
  STYLES,
  TARGET_AUDIENCES,
  VERSE_THEMES,
} from "@/lib/config/book-options";
import { TRIM_SIZES } from "@/lib/config/kdp-spec";
import { COLOURING_MODES, PROJECT_STATUSES } from "@/lib/types";

const audienceIds = TARGET_AUDIENCES.map((a) => a.id) as [string, ...string[]];
const styleIds = STYLES.map((s) => s.id) as [string, ...string[]];
const complexityIds = COMPLEXITY_LEVELS.map((c) => c.id) as [string, ...string[]];
const trimSizeIds = Object.keys(TRIM_SIZES) as [string, ...string[]];

export const interiorOptionsSchema = z.object({
  singleSided: z.boolean(),
  blankPageBehindEach: z.boolean(),
  includeTitlePage: z.boolean(),
  includeCopyrightPage: z.boolean(),
  includeBelongsToPage: z.boolean(),
  includeTestColourPage: z.boolean(),
  includeThankYouPage: z.boolean(),
  frontMatterOrder: z
    .array(z.enum(["titlePage", "copyrightPage", "belongsToPage", "testColourPage"]))
    .default(["titlePage", "copyrightPage", "belongsToPage", "testColourPage"]),
  blankPageMessage: z.boolean().default(false),
});

const baseProjectSchema = z.object({
  name: z.string().trim().min(1, "Project name is required").max(200),
  title: z.string().trim().min(1, "Book title is required").max(300),
  subtitle: z.string().trim().max(300).nullish(),
  author: z.string().trim().max(200).nullish(),
  niche: z.string().trim().min(1, "Niche/topic is required").max(500),
  subNiche: z.string().trim().max(500).nullish(),
  specificAngle: z.string().trim().max(3000).nullish(),
  description: z.string().trim().max(2000).nullish(),
  emotionalTones: z
    .array(z.enum(EMOTIONAL_TONES.map((t) => t.id) as [string, ...string[]]))
    .max(EMOTIONAL_TONES.length)
    .default([]),
  artworkTheme: z.string().trim().max(3000).nullish(),
  colouringMode: z.enum(COLOURING_MODES).default("standard"),
  cbnSettings: z
    .object({
      cbnPageCount: z.number().int().min(0).max(MAX_PAGE_COUNT),
      difficulty: z.enum(CBN_DIFFICULTIES.map((d) => d.id) as [string, ...string[]]),
      colourCount: z
        .number()
        .int()
        .min(Math.min(...CBN_COLOUR_COUNTS))
        .max(20),
      paletteMode: z.enum(["ai", "custom"]),
      customPalette: z
        .array(
          z.object({
            name: z.string().trim().min(1).max(40),
            hex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
          }),
        )
        .max(20),
      keyPlacement: z.enum(CBN_KEY_PLACEMENTS.map((k) => k.id) as [string, ...string[]]),
      autoSelectPages: z.boolean(),
    })
    .optional(),
  bibleSettings: z
    .object({
      enabled: z.boolean(),
      translation: z.enum(BIBLE_TRANSLATIONS.map((t) => t.id) as [string, ...string[]]),
      themes: z
        .array(z.enum(VERSE_THEMES.map((t) => t.id) as [string, ...string[]]))
        .max(VERSE_THEMES.length),
      includeVerseText: z.boolean(),
      includeReference: z.boolean(),
    })
    .optional(),
  targetAudience: z.enum(audienceIds),
  customAudience: z.string().trim().max(200).nullish(),
  trimSize: z.enum(trimSizeIds),
  numberOfDesigns: z
    .number()
    .int()
    .min(MIN_PAGE_COUNT, `Must be at least ${MIN_PAGE_COUNT}`)
    .max(MAX_PAGE_COUNT, `Must be at most ${MAX_PAGE_COUNT}`),
  style: z.enum(styleIds),
  customStyle: z.string().trim().max(1000).nullish(),
  complexity: z.enum(complexityIds),
  complexityOverridden: z.boolean().default(false),
  interiorOptions: interiorOptionsSchema,
});

const audienceRefinement = (
  data: { targetAudience?: string; customAudience?: string | null },
  ctx: z.RefinementCtx,
) => {
  if (data.targetAudience === "custom" && !data.customAudience?.trim()) {
    ctx.addIssue({
      code: "custom",
      path: ["customAudience"],
      message: "Describe your custom audience",
    });
  }
};

const styleRefinement = (
  data: { style?: string; customStyle?: string | null },
  ctx: z.RefinementCtx,
) => {
  if (data.style === "custom" && !data.customStyle?.trim()) {
    ctx.addIssue({
      code: "custom",
      path: ["customStyle"],
      message: "Describe your custom style",
    });
  }
};

export const projectCreateSchema = baseProjectSchema
  .superRefine(audienceRefinement)
  .superRefine(styleRefinement);

export const projectUpdateSchema = baseProjectSchema
  .extend({ status: z.enum(PROJECT_STATUSES) })
  .partial()
  .superRefine(audienceRefinement)
  .superRefine(styleRefinement);

export type ProjectCreateInput = z.infer<typeof projectCreateSchema>;
export type ProjectUpdateInput = z.infer<typeof projectUpdateSchema>;
