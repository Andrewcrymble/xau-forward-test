import { prisma } from "@/lib/db";
import { getImageProvider } from "@/lib/ai";
import { getImageStorage } from "@/lib/storage";
import { PageServiceError } from "@/lib/services/page-service";
import { computeInteriorLayout } from "@/lib/services/interior-service";
import { buildCoverPdf } from "@/lib/pdf/cover-pdf";
import {
  audiencePromptText,
  stylePromptText,
} from "@/lib/config/book-options";
import {
  MIN_SPINE_TEXT_WIDTH_IN,
  TRIM_SIZES,
  calculateCoverDimensions,
  type PaperType,
} from "@/lib/config/kdp-spec";
import {
  DEFAULT_COVER_SETTINGS,
  type CoverDto,
  type CoverSettings,
} from "@/lib/types";
import type { CoverUpdateBody } from "@/lib/validation/cover";

function parseSettings(json: string): CoverSettings {
  try {
    return { ...DEFAULT_COVER_SETTINGS, ...JSON.parse(json) };
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
 *  so the artwork itself must contain no text. */
function coverArtPrompt(project: {
  title: string;
  niche: string;
  description: string | null;
  targetAudience: string;
  customAudience: string | null;
  style: string;
  customStyle: string | null;
}): string {
  return [
    `Vibrant, professional book cover illustration for a colouring book about: ${project.niche}.`,
    project.description?.trim() ? `Additional context: ${project.description.trim()}` : "",
    `Aimed at ${audiencePromptText(project.targetAudience, project.customAudience)}.`,
    `Art direction: rich full colour, inviting and commercial, inspired by ${stylePromptText(project.style, project.customStyle)}.`,
    "Portrait orientation. A single striking scene with a clear focal subject and space above it for a title.",
    "Absolutely NO text, NO lettering, NO title, NO words, NO logos, NO watermarks anywhere in the image.",
  ]
    .filter(Boolean)
    .join(" ");
}

export async function generateCoverArtwork(projectId: string): Promise<CoverDto> {
  const { project, cover } = await ensureCover(projectId);
  const settings = parseSettings(cover.settings);

  const provider = getImageProvider();
  const image = await provider.generateImage({
    prompt: coverArtPrompt(project),
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

  const { pdf } = await buildCoverPdf({
    title: cover.title ?? project.title,
    subtitle: cover.subtitle,
    author: cover.author,
    spineText: cover.spineText,
    backCoverText: cover.backCoverText,
    artwork,
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
