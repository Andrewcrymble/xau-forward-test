import { z } from "zod";

const hexColour = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const coverSettingsSchema = z.object({
  paperType: z.enum(["blackWhiteWhitePaper", "blackWhiteCreamPaper", "colourWhitePaper"]),
  titleFont: z.enum(["serif", "sans"]),
  titleSize: z.number().min(18).max(96),
  titlePosition: z.enum(["top", "middle", "bottom"]),
  textAlign: z.enum(["left", "center", "right"]),
  textColor: hexColour,
  textEffect: z.enum(["none", "outline", "shadow", "plate"]),
  effectColor: hexColour,
  backgroundColor: hexColour,
  barcodeAreaClear: z.boolean(),
  backArtwork: z.boolean(),
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
