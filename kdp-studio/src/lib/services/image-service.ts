import { prisma } from "@/lib/db";
import { getImageProvider } from "@/lib/ai";
import { getImageStorage } from "@/lib/storage";
import { normaliseToPrintCanvas } from "@/lib/images/normalise";
import { PageServiceError } from "@/lib/services/page-service";
import type { PageDto } from "@/lib/types";

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
  prompt: string;
  promptEdited: boolean;
  originalImage: string | null;
  processedImage: string | null;
  generationStatus: string;
  approvalStatus: string;
  validationStatus: string;
  validationIssues: string | null;
  generationAttempts: number;
  notes: string | null;
}): PageDto {
  return {
    id: p.id,
    pageNumber: p.pageNumber,
    title: p.title,
    concept: p.concept,
    prompt: p.prompt,
    promptEdited: p.promptEdited,
    originalImage: p.originalImage,
    processedImage: p.processedImage,
    generationStatus: p.generationStatus as PageDto["generationStatus"],
    approvalStatus: p.approvalStatus as PageDto["approvalStatus"],
    validationStatus: p.validationStatus as PageDto["validationStatus"],
    validationIssues: p.validationIssues,
    generationAttempts: p.generationAttempts,
    notes: p.notes,
  };
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
    const provider = getImageProvider();
    const image = await provider.generateImage({
      prompt: page.prompt,
      seed: page.pageNumber,
    });

    const storage = getImageStorage();
    const versionNumber =
      (await prisma.imageVersion.count({ where: { pageId } })) + 1;
    const keyBase = `projects/${page.projectId}/pages/${page.id}/v${versionNumber}`;

    const originalUrl = await storage.put(
      `${keyBase}-original.png`,
      image.data,
      image.contentType,
    );

    const result = await normaliseToPrintCanvas(image.data);
    if (result.report.status === "failed") {
      throw new Error(result.report.issues.join("; "));
    }
    const processedUrl = await storage.put(
      `${keyBase}-print.png`,
      result.processed,
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
