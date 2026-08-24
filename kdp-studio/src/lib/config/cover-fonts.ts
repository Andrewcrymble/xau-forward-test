// Central registry of cover title fonts. Each entry names the TTF files
// embedded in the exported PDF (src/assets/fonts) and the matching CSS
// family for the live preview (@font-face rules in globals.css point at
// the same files served from /fonts). Display fonts have a single weight,
// so the title file doubles as its own bold; subtitle/author text pairs
// them with clean Liberation Sans for contrast.

export interface CoverFontDef {
  id: string;
  label: string;
  /** TTF used for the title and spine. */
  titleFile: string;
  /** TTF used for subtitle, author and back-cover text. */
  bodyFile: string;
  /** Preview CSS font-family for the title. */
  cssTitle: string;
  /** Preview CSS font-family for subtitle/author/back text. */
  cssBody: string;
}

export const COVER_FONTS: CoverFontDef[] = [
  {
    id: "serif",
    label: "Serif (classic)",
    titleFile: "LiberationSerif-Bold.ttf",
    bodyFile: "LiberationSerif-Regular.ttf",
    cssTitle: "'Liberation Serif', Georgia, serif",
    cssBody: "'Liberation Serif', Georgia, serif",
  },
  {
    id: "sans",
    label: "Sans-serif (modern)",
    titleFile: "LiberationSans-Bold.ttf",
    bodyFile: "LiberationSans-Regular.ttf",
    cssTitle: "'Liberation Sans', Arial, sans-serif",
    cssBody: "'Liberation Sans', Arial, sans-serif",
  },
  {
    id: "playful",
    label: "Playful (rounded)",
    titleFile: "Chewy-Regular.ttf",
    bodyFile: "LiberationSans-Regular.ttf",
    cssTitle: "'Chewy', 'Comic Sans MS', cursive",
    cssBody: "'Liberation Sans', Arial, sans-serif",
  },
  {
    id: "comic",
    label: "Comic (bold caps)",
    titleFile: "LuckiestGuy-Regular.ttf",
    bodyFile: "LiberationSans-Regular.ttf",
    cssTitle: "'Luckiest Guy', 'Comic Sans MS', cursive",
    cssBody: "'Liberation Sans', Arial, sans-serif",
  },
  {
    id: "script",
    label: "Script (handwritten)",
    titleFile: "Pacifico-Regular.ttf",
    bodyFile: "LiberationSans-Regular.ttf",
    cssTitle: "'Pacifico', 'Brush Script MT', cursive",
    cssBody: "'Liberation Sans', Arial, sans-serif",
  },
  {
    id: "elegant",
    label: "Elegant (display serif)",
    titleFile: "AbrilFatface-Regular.ttf",
    bodyFile: "LiberationSerif-Regular.ttf",
    cssTitle: "'Abril Fatface', Georgia, serif",
    cssBody: "'Liberation Serif', Georgia, serif",
  },
  {
    id: "slab",
    label: "Chunky slab",
    titleFile: "AlfaSlabOne-Regular.ttf",
    bodyFile: "LiberationSans-Regular.ttf",
    cssTitle: "'Alfa Slab One', Georgia, serif",
    cssBody: "'Liberation Sans', Arial, sans-serif",
  },
];

export const COVER_FONT_IDS = COVER_FONTS.map((f) => f.id) as [string, ...string[]];

export function coverFont(id: string): CoverFontDef {
  return COVER_FONTS.find((f) => f.id === id) ?? COVER_FONTS[0];
}
