import { z } from "zod";

export const coverSettingsSchema = z.object({
  paperType: z.enum(["blackWhiteWhitePaper", "blackWhiteCreamPaper", "colourWhitePaper"]),
  titleFont: z.enum(["serif", "sans"]),
  titleSize: z.number().min(18).max(96),
  titlePosition: z.enum(["top", "middle", "bottom"]),
  textAlign: z.enum(["left", "center", "right"]),
  textColor: z.enum(["white", "black"]),
  backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  barcodeAreaClear: z.boolean(),
  artworkVersions: z.array(z.string()).max(50),
});

export const coverUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(300),
    subtitle: z.string().trim().max(300).nullable(),
    author: z.string().trim().max(200).nullable(),
    spineText: z.string().trim().max(200).nullable(),
    backCoverText: z.string().trim().max(3000).nullable(),
    settings: coverSettingsSchema.partial(),
  })
  .partial();

export type CoverUpdateBody = z.infer<typeof coverUpdateSchema>;
