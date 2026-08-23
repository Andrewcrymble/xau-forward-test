import { z } from "zod";

export const pageEditSchema = z
  .object({
    title: z.string().trim().min(1).max(300),
    concept: z.string().trim().min(1).max(3000),
    prompt: z.string().trim().min(1).max(8000),
    notes: z.string().trim().max(2000).nullable(),
  })
  .partial();

export const pageAddSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(300),
  concept: z.string().trim().min(1, "Concept is required").max(3000),
});

export const reorderSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1),
});

export type PageEditBody = z.infer<typeof pageEditSchema>;
export type PageAddBody = z.infer<typeof pageAddSchema>;
