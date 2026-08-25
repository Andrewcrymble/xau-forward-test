import sharp from "sharp";
import type { ColouringPage, Project } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getImageProvider } from "@/lib/ai";
import type { GeneratedImage } from "@/lib/ai/types";
import { getImageStorage } from "@/lib/storage";
import { normaliseToPrintCanvas } from "@/lib/images/normalise";
import { overlayPageText } from "@/lib/images/verse-overlay";
import { processColourByNumbers } from "@/lib/images/colour-by-numbers";
import {
  buildCbnArtworkPrompt,
  CBN_REFERENCE_IMAGE_INSTRUCTION,
  REFERENCE_IMAGE_INSTRUCTION,
} from "@/lib/config/colouring-rules";
import {
  CBN_DIFFICULTIES,
  audiencePromptText,
  stylePromptText,
} from "@/lib/config/book-options";
import { composePrompt, PageServiceError } from "@/lib/services/page-service";
import { parseBookConcept } from "@/lib/services/project-service";
import { DEFAULT_CBN_SETTINGS, type CbnSettings, type PageDto } from "@/lib/types";

// One call = one page = one provider request. The client-side queue fans
// these out with bounded concurrency, so each call stays well inside a
// single serverless invocation on hosted deployments.

export interface VersionDto {
  id: string;
  versionNumber: number;
  originalImage: string;
  processedImage: string | null;
  createdAt: string;
  isCurrent: boolean;
}

function pageToDto(p: {
  id: string;
  pageNumber: number;
  title: string;
  concept: string;
  pageType: string;
  pageText: string | null;
  cbnData: string | null;
  completedReference: string | null;
  prompt: string;
  promptEdited: boolean;
  originalImage: string | null;
  processedImage: string | null;
  referenceImage: string | null;
  generationStatus: string;
  approvalStatus: string;
  validationStatus: string;
  validationIssues: string | null;
  generationAttempts: number;
  notes: string | null;
}): PageDto {
  let cbnData = null;
  if (p.cbnData) {
    try {
      cbnData = JSON.parse(p.cbnData);
    } catch {
      cbnData = null;
    }
  }
  return {
    id: p.id,
    pageNumber: p.pageNumber,
    title: p.title,
    concept: p.concept,
    pageType: (p.pageType as PageDto["pageType"]) ?? "standard",
    pageText: p.pageText,
    cbnData,
    completedReference: p.completedReference,
    prompt: p.prompt,
    promptEdited: p.promptEdited,
    originalImage: p.originalImage,
    processedImage: p.processedImage,
    referenceImage: p.referenceImage,
    generationStatus: p.generationStatus as PageDto["generationStatus"],
    approvalStatus: p.approvalStatus as PageDto["approvalStatus"],
    validationStatus: p.validationStatus as PageDto["validationStatus"],
    validationIssues: p.validationIssues,
    generationAttempts: p.generationAttempts,
    notes: p.notes,
  };
}

/**
 * Set or remove a page's reference photo. The image is downscaled and
 * re-encoded as JPEG (photos compress far better than PNG), stored under
 * the page's own key prefix, and any previous reference file is deleted.
 */
export async function setPageReference(
  pageId: string,
  imageBytes: Buffer | null,
): Promise<PageDto> {
  const page = await prisma.colouringPage.findUnique({ where: { id: pageId } });
  if (!page) throw new PageServiceError("Page not found", 404);
  const storage = getImageStorage();

  let url: string | null = null;
  if (imageBytes) {
    let jpeg: Buffer;
    try {
      jpeg = await sharp(imageBytes)
        .rotate() // honour EXIF orientation from phone/tablet cameras
        .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
        .flatten({ background: "#ffffff" })
        .jpeg({ quality: 85 })
        .toBuffer();
    } catch {
      throw new PageServiceError(
        "That file could not be read as an image — upload a JPEG or PNG photo.",
        400,
      );
    }
    url = await storage.put(
      `projects/${page.projectId}/pages/${page.id}/reference-${Date.now()}.jpg`,
      jpeg,
      "image/jpeg",
    );
  }

  // Best-effort: free the previous reference file straight away.
  if (page.referenceImage && page.referenceImage !== url) {
    try {
      await storage.delete(page.referenceImage);
    } catch {
      // Leftovers are swept up by Settings → Free up storage.
    }
  }

  const updated = await prisma.colouringPage.update({
    where: { id: pageId },
    data: { referenceImage: url },
  });
  return pageToDto(updated);
}

/**
 * Generate ONE image for ONE page: provider call → store original →
 * normalise to 2550×3300 → quality checks → new ImageVersion. Previous
 * versions are never overwritten; an approved page keeps its approved
 * image current — the new version waits in the version list.
 */
export async function generatePageImage(pageId: string): Promise<PageDto> {
  const page = await prisma.colouringPage.findUnique({
    where: { id: pageId },
    include: { project: true },
  });
  if (!page) throw new PageServiceError("Page not found", 404);
  if (!page.prompt.trim()) {
    throw new PageServiceError("This page has no prompt — edit it in the Book Plan tab.", 409);
  }
  const wasApproved = page.approvalStatus === "approved";

  await prisma.colouringPage.update({
    where: { id: pageId },
    data: {
      generationStatus: "generating",
      generationAttempts: { increment: 1 },
    },
  });
  await prisma.project.updateMany({
    where: { id: page.projectId, status: "plan_approved" },
    data: { status: "generating" },
  });

  try {
    const isCbn = page.pageType === "colour_by_numbers";
    // CBN pages generate flat-colour base artwork from a dedicated prompt
    // (stored back to the page for transparency unless the user owns it).
    let prompt = page.prompt;
    let cbnSettings: CbnSettings | null = null;
    if (!isCbn && !page.promptEdited) {
      // Un-edited prompts are rebuilt at generation time so every
      // (re)generation uses the CURRENT prompt rules — stored plan-time
      // prompts otherwise fossilise old instructions (e.g. the retired
      // "render this text" block that made the AI draw garbled verses).
      const siblings = await prisma.colouringPage.findMany({
        where: { projectId: page.projectId, NOT: { id: pageId } },
        select: { title: true },
        orderBy: { pageNumber: "asc" },
        take: 40,
      });
      prompt = composePrompt(
        page.project,
        page.concept,
        siblings.map((s) => s.title),
        page.pageText,
      );
      if (prompt !== page.prompt) {
        await prisma.colouringPage.update({
          where: { id: pageId },
          data: { prompt },
        });
      }
    }
    if (isCbn) {
      cbnSettings = parseCbnSettings(page.project.cbnSettings);
      if (!page.promptEdited) {
        prompt = buildCbnPromptForPage(page, page.project, cbnSettings);
        await prisma.colouringPage.update({
          where: { id: pageId },
          data: { prompt },
        });
      }
    }

    // Uploaded reference photo → image-to-image: the provider redraws that
    // exact photo. The instruction is added per-call, never stored, so the
    // page prompt stays clean if the reference is later removed.
    let referenceBytes: Buffer | null = null;
    if (page.referenceImage) {
      try {
        referenceBytes = await getImageStorage().readBytes(page.referenceImage);
        prompt = `${isCbn ? CBN_REFERENCE_IMAGE_INSTRUCTION : REFERENCE_IMAGE_INSTRUCTION}\n\n${prompt}`;
      } catch {
        // Missing file: fall back to prompt-only generation.
      }
    }

    const provider = getImageProvider();
    const image = await provider.generateImage({
      prompt,
      seed: page.pageNumber,
      variant: isCbn ? "cbn-flat" : "line-art",
      referenceImage: referenceBytes,
    });

    const storage = getImageStorage();
    const versionNumber =
      (await prisma.imageVersion.count({ where: { pageId } })) + 1;
    const keyBase = `projects/${page.projectId}/pages/${page.id}/v${versionNumber}`;

    if (isCbn && cbnSettings) {
      return await finishCbnGeneration({
        page,
        image,
        cbnSettings,
        keyBase,
        wasApproved,
      });
    }

    // Re-encode the original as palette PNG — visually lossless for line
    // art and far smaller, which matters on storage quotas.
    let originalBytes = image.data;
    try {
      originalBytes = await sharp(image.data)
        .png({ compressionLevel: 9, palette: true })
        .toBuffer();
    } catch {
      originalBytes = image.data;
    }
    const originalUrl = await storage.put(
      `${keyBase}-original.png`,
      originalBytes,
      "image/png",
    );

    const result = await normaliseToPrintCanvas(image.data);
    if (result.report.status === "failed") {
      throw new Error(result.report.issues.join("; "));
    }
    // Intentional text (verses, quotes) is typeset by the app — the image AI
    // never draws words, because image models garble long text.
    let printBytes = result.processed;
    if (page.pageText?.trim()) {
      try {
        let fontId: string | null = null;
        try {
          fontId = (JSON.parse(page.project.bibleSettings || "{}") as { verseFont?: string })
            .verseFont ?? null;
        } catch {
          fontId = null;
        }
        printBytes = await overlayPageText(printBytes, page.pageText, fontId);
      } catch (err) {
        console.warn("verse overlay failed, keeping plain page:", err);
      }
    }
    const processedUrl = await storage.put(
      `${keyBase}-print.png`,
      printBytes,
      "image/png",
    );

    await prisma.imageVersion.create({
      data: {
        pageId,
        versionNumber,
        originalImage: originalUrl,
        processedImage: processedUrl,
      },
    });

    const updated = await prisma.colouringPage.update({
      where: { id: pageId },
      data: wasApproved
        ? {
            // Approved artwork stays current; the new version is available
            // in the version picker.
            generationStatus: "approved",
          }
        : {
            originalImage: originalUrl,
            processedImage: processedUrl,
            generationStatus:
              result.report.status === "needs_review"
                ? "needs_review"
                : "ready_for_review",
            validationStatus: result.report.status,
            validationIssues:
              result.report.issues.length > 0
                ? result.report.issues.join("\n")
                : null,
          },
    });

    await prisma.generationLog.create({
      data: {
        projectId: page.projectId,
        kind: "page_image",
        provider: image.provider,
        model: image.model,
        estimatedCost: image.estimatedCost ?? null,
        imageCount: 1,
        message: `Page ${page.pageNumber} v${versionNumber}: ${result.report.status}`,
      },
    });

    return pageToDto(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const updated = await prisma.colouringPage.update({
      where: { id: pageId },
      data: wasApproved
        ? { generationStatus: "approved" }
        : { generationStatus: "failed", validationIssues: message },
    });
    await prisma.generationLog.create({
      data: {
        projectId: page.projectId,
        kind: "page_image_error",
        message: `Page ${page.pageNumber}: ${message.slice(0, 500)}`,
      },
    });
    // Surface provider errors to the client but keep the page row intact —
    // one failure must never break the rest of the batch.
    if (wasApproved) {
      throw new PageServiceError(
        `Generation failed (approved artwork kept): ${message}`,
        502,
      );
    }
    return pageToDto(updated);
  }
}

export async function listVersions(pageId: string): Promise<VersionDto[]> {
  const page = await prisma.colouringPage.findUnique({
    where: { id: pageId },
    include: { versions: { orderBy: { versionNumber: "desc" } } },
  });
  if (!page) throw new PageServiceError("Page not found", 404);
  return page.versions.map((v) => ({
    id: v.id,
    versionNumber: v.versionNumber,
    originalImage: v.originalImage,
    processedImage: v.processedImage,
    createdAt: v.createdAt.toISOString(),
    isCurrent: v.processedImage === page.processedImage,
  }));
}

/** Make a stored version the page's current image. */
export async function selectVersion(
  pageId: string,
  versionId: string,
): Promise<PageDto> {
  const version = await prisma.imageVersion.findUnique({ where: { id: versionId } });
  if (!version || version.pageId !== pageId) {
    throw new PageServiceError("Version not found", 404);
  }
  const page = await prisma.colouringPage.findUnique({ where: { id: pageId } });
  if (!page) throw new PageServiceError("Page not found", 404);

  const switching = page.processedImage !== version.processedImage;
  const updated = await prisma.colouringPage.update({
    where: { id: pageId },
    data: {
      originalImage: version.originalImage,
      processedImage: version.processedImage,
      // Switching away from an approved image needs a fresh review.
      ...(switching && page.approvalStatus === "approved"
        ? { approvalStatus: "pending", generationStatus: "ready_for_review" }
        : {}),
      ...(switching && page.approvalStatus !== "approved"
        ? { generationStatus: "ready_for_review" }
        : {}),
    },
  });
  return pageToDto(updated);
}

export type ReviewAction = "approve" | "unapprove" | "reject";

export async function reviewPage(
  pageId: string,
  action: ReviewAction,
): Promise<PageDto> {
  const page = await prisma.colouringPage.findUnique({ where: { id: pageId } });
  if (!page) throw new PageServiceError("Page not found", 404);
  if (action === "approve" && !page.processedImage) {
    throw new PageServiceError("Generate an image before approving this page.", 409);
  }
  const data =
    action === "approve"
      ? { approvalStatus: "approved", generationStatus: "approved" }
      : action === "reject"
        ? { approvalStatus: "rejected", generationStatus: "needs_review" }
        : {
            approvalStatus: "pending",
            generationStatus: page.processedImage ? "ready_for_review" : "planned",
          };
  const updated = await prisma.colouringPage.update({
    where: { id: pageId },
    data,
  });
  return pageToDto(updated);
}

// ---------------------------------------------------------------------------
// Colour-by-numbers generation
// ---------------------------------------------------------------------------

function parseCbnSettings(json: string): CbnSettings {
  try {
    return { ...DEFAULT_CBN_SETTINGS, ...JSON.parse(json || "{}") };
  } catch {
    return { ...DEFAULT_CBN_SETTINGS };
  }
}

type PageWithProject = ColouringPage & { project: Project };

function buildCbnPromptForPage(
  page: PageWithProject,
  project: Project,
  settings: CbnSettings,
): string {
  const concept = parseBookConcept(project.bookConcept);
  const difficulty =
    CBN_DIFFICULTIES.find((d) => d.id === settings.difficulty)?.promptText ??
    "clear enclosed shapes";
  return buildCbnArtworkPrompt({
    pageConcept: page.concept,
    styleInstruction: stylePromptText(project.style, project.customStyle),
    audienceDescription: audiencePromptText(
      project.targetAudience,
      project.customAudience,
    ),
    difficultyInstruction: difficulty,
    colourCount: settings.colourCount,
    paletteDescription:
      settings.paletteMode === "custom" && settings.customPalette.length > 0
        ? settings.customPalette.map((c) => c.name).join(", ")
        : null,
    creativeBrief: concept?.creativeBrief ?? null,
    styleProfile: concept?.styleProfile ?? null,
    character: concept?.character ?? null,
  });
}

async function finishCbnGeneration(args: {
  page: PageWithProject;
  image: GeneratedImage;
  cbnSettings: CbnSettings;
  keyBase: string;
  wasApproved: boolean;
}): Promise<PageDto> {
  const { page, image, cbnSettings, keyBase, wasApproved } = args;
  const storage = getImageStorage();

  const originalUrl = await storage.put(
    `${keyBase}-original.png`,
    await sharp(image.data).png({ compressionLevel: 9, palette: true }).toBuffer(),
    "image/png",
  );

  // Programmatic pipeline: quantise → segment → merge → outline → number →
  // key → completed reference → validate. Numbers are NEVER left to the AI.
  const result = await processColourByNumbers({
    image: image.data,
    difficulty: cbnSettings.difficulty,
    colourCount: cbnSettings.colourCount,
    customPalette:
      cbnSettings.paletteMode === "custom" ? cbnSettings.customPalette : null,
    keyPlacement: cbnSettings.keyPlacement,
  });

  const processedUrl = await storage.put(
    `${keyBase}-print.png`,
    result.numberedPage,
    "image/png",
  );
  const referenceUrl = await storage.put(
    `${keyBase}-reference.png`,
    result.reference,
    "image/png",
  );

  const versionNumber = Number(keyBase.match(/v(\d+)$/)?.[1] ?? "1");
  await prisma.imageVersion.create({
    data: {
      pageId: page.id,
      versionNumber,
      originalImage: originalUrl,
      processedImage: processedUrl,
    },
  });

  const failed = result.validation.some((v) => v.includes("regenerate"));
  const status = failed
    ? "failed"
    : result.validation.length > 0
      ? "needs_review"
      : "ready_for_review";
  const cbnData = {
    palette: result.palette,
    regions: result.regions,
    difficulty: cbnSettings.difficulty,
    validation: result.validation,
  };

  const updated = await prisma.colouringPage.update({
    where: { id: page.id },
    data: wasApproved
      ? { generationStatus: "approved" }
      : {
          originalImage: originalUrl,
          processedImage: processedUrl,
          completedReference: referenceUrl,
          cbnData: JSON.stringify(cbnData),
          generationStatus: status,
          validationStatus: failed
            ? "failed"
            : result.validation.length > 0
              ? "needs_review"
              : "passed",
          validationIssues:
            result.validation.length > 0 ? result.validation.join("\n") : null,
        },
  });

  await prisma.generationLog.create({
    data: {
      projectId: page.projectId,
      kind: "page_image",
      provider: image.provider,
      model: image.model,
      estimatedCost: image.estimatedCost ?? null,
      imageCount: 1,
      message: `Page ${page.pageNumber} v${versionNumber} (colour by numbers, ${result.regions.length} regions, ${result.palette.length} colours): ${status}`,
    },
  });

  return pageToDto(updated);
}
