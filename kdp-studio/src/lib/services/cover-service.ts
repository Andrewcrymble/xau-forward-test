import { prisma } from "@/lib/db";
import { pruneOldExports } from "@/lib/services/maintenance-service";
import { getImageProvider, getTextProvider } from "@/lib/ai";
import { getImageStorage } from "@/lib/storage";
import { PageServiceError } from "@/lib/services/page-service";
import { computeInteriorLayout } from "@/lib/services/interior-service";
import { buildCoverPdf } from "@/lib/pdf/cover-pdf";
import {
  audiencePromptText,
  stylePromptText,
  tonesPromptText,
} from "@/lib/config/book-options";
import { resolveColourJoyStyle } from "@/lib/config/colourjoy-styles";
import {
  MIN_SPINE_TEXT_WIDTH_IN,
  TRIM_SIZES,
  calculateCoverDimensions,
  type PaperType,
} from "@/lib/config/kdp-spec";
import {
  DEFAULT_COVER_SETTINGS,
  type CoverConcept,
  type CoverDto,
  type CoverSettings,
} from "@/lib/types";
import type { CoverUpdateBody } from "@/lib/validation/cover";

function parseSettings(json: string): CoverSettings {
  try {
    const parsed = JSON.parse(json) as Partial<CoverSettings>;
    // Settings saved before the legibility options stored named text colours.
    if (parsed.textColor === "white") parsed.textColor = "#ffffff";
    else if (parsed.textColor === "black") {
      parsed.textColor = "#111111";
      // Dark text needs a light effect colour to stand out over artwork.
      if (!parsed.effectColor) parsed.effectColor = "#ffffff";
    }
    return { ...DEFAULT_COVER_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_COVER_SETTINGS };
  }
}

async function requireProject(projectId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new PageServiceError("Project not found", 404);
  return project;
}

/** Load the cover row, creating it (pre-filled from the project) if absent. */
async function ensureCover(projectId: string) {
  const project = await requireProject(projectId);
  let cover = await prisma.cover.findUnique({ where: { projectId } });
  if (!cover) {
    cover = await prisma.cover.create({
      data: {
        projectId,
        title: project.title,
        subtitle: project.subtitle,
        author: project.author,
        spineText: project.title,
        settings: JSON.stringify(DEFAULT_COVER_SETTINGS),
      },
    });
  }
  return { project, cover };
}

/** Up to `count` approved page images, sampled evenly across the book, for
 *  the back-cover showcase layout (1 hero + 2 stacked + a row of 4). */
export async function showcasePageUrls(
  projectId: string,
  count = 7,
): Promise<string[]> {
  const pages = await prisma.colouringPage.findMany({
    where: { projectId, approvalStatus: "approved", NOT: { processedImage: null } },
    orderBy: { pageNumber: "asc" },
    select: { processedImage: true },
  });
  const urls = pages.map((p) => p.processedImage!);
  if (urls.length <= count) return urls;
  const picked: string[] = [];
  for (let i = 0; i < count; i++) {
    picked.push(urls[Math.round((i * (urls.length - 1)) / (count - 1))]);
  }
  return [...new Set(picked)];
}

async function toDto(projectId: string): Promise<CoverDto> {
  const { project, cover } = await ensureCover(projectId);
  const settings = parseSettings(cover.settings);
  const layout = await computeInteriorLayout(projectId);
  const trim = TRIM_SIZES[project.trimSize];
  const dims = calculateCoverDimensions({
    trimSizeId: project.trimSize,
    pageCount: layout.pageCount,
    paperType: settings.paperType as PaperType,
  });
  return {
    title: cover.title ?? project.title,
    subtitle: cover.subtitle,
    author: cover.author,
    spineText: cover.spineText,
    backCoverText: cover.backCoverText,
    artwork: cover.artwork,
    showcasePages: await showcasePageUrls(projectId),
    settings,
    dims: {
      pageCount: layout.pageCount,
      spineIn: dims.spineIn,
      totalWidthIn: dims.totalWidthIn,
      totalHeightIn: dims.totalHeightIn,
      bleedIn: dims.bleedIn,
      trimWidthIn: trim.widthIn,
      trimHeightIn: trim.heightIn,
      spineTextAllowed: dims.spineIn >= MIN_SPINE_TEXT_WIDTH_IN,
    },
  };
}

export async function getCover(projectId: string): Promise<CoverDto> {
  return toDto(projectId);
}

export async function updateCover(
  projectId: string,
  input: CoverUpdateBody,
): Promise<CoverDto> {
  const { cover } = await ensureCover(projectId);
  const current = parseSettings(cover.settings);
  await prisma.cover.update({
    where: { projectId },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.subtitle !== undefined ? { subtitle: input.subtitle } : {}),
      ...(input.author !== undefined ? { author: input.author } : {}),
      ...(input.spineText !== undefined ? { spineText: input.spineText } : {}),
      ...(input.backCoverText !== undefined ? { backCoverText: input.backCoverText } : {}),
      ...(input.settings !== undefined
        ? { settings: JSON.stringify({ ...current, ...input.settings }) }
        : {}),
    },
  });
  return toDto(projectId);
}

/** Colourful commercial cover artwork — a completely separate prompt from
 *  the black-and-white interior pages. Typography is added by the editor,
 *  so the artwork itself must contain no text. When a cover concept has
 *  been developed and selected, the prompt is built from that concept. */
function coverArtPrompt(
  project: {
    title: string;
    niche: string;
    description: string | null;
    targetAudience: string;
    customAudience: string | null;
    style: string;
    customStyle: string | null;
  },
  concept?: CoverConcept | null,
): string {
  const noText =
    "Absolutely NO text, NO lettering, NO title, NO words, NO logos, NO watermarks anywhere in the image.";
  if (concept) {
    return [
      `Vibrant, professional retail book cover illustration for a colouring book about: ${project.niche}.`,
      `Aimed at ${audiencePromptText(project.targetAudience, project.customAudience)}.`,
      `Hero composition (${concept.name}): ${concept.heroDescription}`,
      `Background: ${concept.background}`,
      concept.palette.length > 0
        ? `Deliberate dominant colour palette: ${concept.palette.join(", ")}. Use these colours with strong contrast between the focal subject and the background.`
        : "",
      "ONE cohesive full-colour composition — never a collage of disconnected elements. The hero subject carries 55-70% of the visual weight.",
      "The focal subject must read instantly even at 150-pixel thumbnail size.",
      "Portrait orientation. Keep clear, calm space above the scene for a title and near the bottom for a subtitle.",
      noText,
    ]
      .filter(Boolean)
      .join(" ");
  }
  return [
    `Vibrant, professional book cover illustration for a colouring book about: ${project.niche}.`,
    project.description?.trim() ? `Additional context: ${project.description.trim()}` : "",
    `Aimed at ${audiencePromptText(project.targetAudience, project.customAudience)}.`,
    `Art direction: rich full colour, inviting and commercial, inspired by ${stylePromptText(project.style, project.customStyle)}.`,
    "Portrait orientation. A single striking scene with a clear focal subject and space above it for a title.",
    noText,
  ]
    .filter(Boolean)
    .join(" ");
}

/** The concept currently driving artwork generation, when one is selected. */
function selectedConcept(settings: CoverSettings): CoverConcept | null {
  const idx = settings.selectedCoverConcept;
  if (idx === null || idx === undefined) return null;
  return settings.coverConcepts?.[idx] ?? null;
}

/** Develop three scored retail cover directions (Story / Iconic / Premium)
 *  and store them in the cover settings. Replaces any previous set — the
 *  selection resets so artwork is never generated from a stale index. */
export async function generateCoverConcepts(projectId: string): Promise<CoverDto> {
  const { project, cover } = await ensureCover(projectId);
  const settings = parseSettings(cover.settings);

  let tones = "";
  try {
    tones = tonesPromptText(JSON.parse(project.emotionalTones || "[]"));
  } catch {
    tones = "";
  }

  const provider = getTextProvider();
  const { concepts, usage } = await provider.generateCoverConcepts({
    title: cover.title ?? project.title,
    subtitle: cover.subtitle,
    niche: project.niche,
    subNiche: project.subNiche,
    audience: audiencePromptText(project.targetAudience, project.customAudience),
    tones: tones || null,
    styleLabel: resolveColourJoyStyle(project).label,
  });

  await prisma.cover.update({
    where: { projectId },
    data: {
      settings: JSON.stringify({
        ...settings,
        coverConcepts: concepts,
        selectedCoverConcept: null,
      }),
    },
  });
  await prisma.generationLog.create({
    data: {
      projectId,
      kind: "cover_concepts",
      provider: usage.provider,
      model: usage.model,
      tokensUsed: usage.tokensUsed ?? null,
      message: `Developed ${concepts.length} cover concepts`,
    },
  });
  return toDto(projectId);
}

/** Choose which developed concept drives artwork generation. */
export async function selectCoverConcept(
  projectId: string,
  index: number,
): Promise<CoverDto> {
  const { cover } = await ensureCover(projectId);
  const settings = parseSettings(cover.settings);
  if (!settings.coverConcepts || !settings.coverConcepts[index]) {
    throw new PageServiceError("Unknown cover concept", 404);
  }
  await prisma.cover.update({
    where: { projectId },
    data: {
      settings: JSON.stringify({ ...settings, selectedCoverConcept: index }),
    },
  });
  return toDto(projectId);
}

export async function generateCoverArtwork(projectId: string): Promise<CoverDto> {
  const { project, cover } = await ensureCover(projectId);
  const settings = parseSettings(cover.settings);

  const provider = getImageProvider();
  const image = await provider.generateImage({
    prompt: coverArtPrompt(project, selectedConcept(settings)),
    seed: settings.artworkVersions.length + 1,
    variant: "cover",
  });

  const storage = getImageStorage();
  const url = await storage.put(
    `projects/${projectId}/cover/art-v${settings.artworkVersions.length + 1}.png`,
    image.data,
    image.contentType,
  );

  const versions = [...settings.artworkVersions, url];
  await prisma.cover.update({
    where: { projectId },
    data: {
      // New artwork becomes current only when nothing is selected yet —
      // an approved choice is never silently replaced.
      ...(cover.artwork ? {} : { artwork: url }),
      settings: JSON.stringify({ ...settings, artworkVersions: versions }),
    },
  });
  await prisma.generationLog.create({
    data: {
      projectId,
      kind: "cover_image",
      provider: image.provider,
      model: image.model,
      estimatedCost: image.estimatedCost ?? null,
      imageCount: 1,
      message: `Cover artwork v${versions.length}`,
    },
  });
  return toDto(projectId);
}

export async function selectCoverArtwork(
  projectId: string,
  url: string,
): Promise<CoverDto> {
  const { cover } = await ensureCover(projectId);
  const settings = parseSettings(cover.settings);
  if (!settings.artworkVersions.includes(url)) {
    throw new PageServiceError("Unknown artwork version", 404);
  }
  await prisma.cover.update({ where: { projectId }, data: { artwork: url } });
  return toDto(projectId);
}

export interface CoverBuildResult {
  url: string;
  bytes: number;
  builtAt: string;
  dims: CoverDto["dims"];
}

export async function buildCover(projectId: string): Promise<CoverBuildResult> {
  const { project, cover } = await ensureCover(projectId);
  const settings = parseSettings(cover.settings);
  const layout = await computeInteriorLayout(projectId);
  if (layout.pageCount === 0) {
    throw new PageServiceError(
      "The book has no pages yet — the spine width depends on the final page count.",
      409,
    );
  }

  const storage = getImageStorage();
  const artwork = cover.artwork ? await storage.readBytes(cover.artwork) : null;
  const showcaseImages =
    settings.backLayout === "showcase"
      ? await Promise.all(
          (await showcasePageUrls(projectId)).map((u) => storage.readBytes(u)),
        )
      : [];

  const { pdf } = await buildCoverPdf({
    title: cover.title ?? project.title,
    subtitle: cover.subtitle,
    author: cover.author,
    spineText: cover.spineText,
    backCoverText: cover.backCoverText,
    artwork,
    showcaseImages,
    settings,
    trimSizeId: project.trimSize,
    pageCount: layout.pageCount,
  });

  const buildNumber =
    (await prisma.export.count({ where: { projectId, type: "cover_pdf" } })) + 1;
  const url = await storage.put(
    `projects/${projectId}/exports/book-cover-v${buildNumber}.pdf`,
    pdf,
    "application/pdf",
  );
  const row = await prisma.export.create({
    data: { projectId, type: "cover_pdf", filePath: url },
  });
  await pruneOldExports(projectId);
  await prisma.project.updateMany({
    where: { id: projectId, status: { in: ["plan_approved", "generating", "reviewing", "interior"] } },
    data: { status: "cover" },
  });

  const dto = await toDto(projectId);
  return { url, bytes: pdf.length, builtAt: row.createdAt.toISOString(), dims: dto.dims };
}

export async function latestCoverExport(projectId: string) {
  const row = await prisma.export.findFirst({
    where: { projectId, type: "cover_pdf" },
    orderBy: { createdAt: "desc" },
  });
  return row ? { url: row.filePath, builtAt: row.createdAt.toISOString() } : null;
}
