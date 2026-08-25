import { z } from "zod";

export const listingContentSchema = z.object({
  titleSuggestions: z.array(z.string().trim().max(300)).max(10),
  title: z.string().trim().max(200, "Amazon titles are limited to 200 characters"),
  subtitle: z.string().trim().max(200),
  description: z.string().trim().max(4000, "Amazon descriptions are limited to 4000 characters"),
  bulletPoints: z.array(z.string().trim().max(500)).max(10),
  keywords: z.array(z.string().trim().max(80)).length(7, "Amazon allows exactly 7 keyword slots"),
  categories: z
    .array(z.string().trim().max(200))
    .max(3, "KDP allows up to 3 categories")
    .default([]),
  audience: z.string().trim().max(1000),
  backCoverDescription: z.string().trim().max(2000),
  shortPromo: z.string().trim().max(500),
  authorNote: z.string().trim().max(2000).default(""),
  insideBook: z.array(z.string().trim().max(300)).max(8).default([]),
  launchPlan: z.array(z.string().trim().max(500)).max(7).default([]),
  etsyTitle: z.string().trim().max(140, "Etsy titles are limited to 140 characters").default(""),
  etsyTags: z
    .array(z.string().trim().max(20, "Etsy tags are limited to 20 characters"))
    .max(13, "Etsy allows up to 13 tags")
    .default([]),
  etsyDescription: z.string().trim().max(5000).default(""),
});

export const listingUpdateSchema = listingContentSchema.partial();

export type ListingUpdateBody = z.infer<typeof listingUpdateSchema>;
