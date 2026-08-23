import { prisma } from "@/lib/db";
import { getImageStorage } from "@/lib/storage";
import { PageServiceError } from "@/lib/services/page-service";
import { buildInteriorPdf } from "@/lib/pdf/interior-pdf";
import {
  DEFAULT_INTERIOR_OPTIONS,
  FRONT_MATTER_KEYS,
  type FrontMatterKey,
  type InteriorOptions,
} from "@/lib/types";
import {
  KDP_MIN_PAGE_COUNT,
  KDP_MAX_PAGE_COUNT_BW,
} from "@/lib/config/kdp-spec";

// Interior layout + build. Page 1 of a KDP paperback is always a
// right-hand (recto) page; recto pages are the odd-numbered ones. For
// single-sided books every colouring illustration must land on a recto,
// which the layout guarantees by inserting blank pages where needed.

export interface InteriorSlot {
  pageNumber: number;
  kind: "front_matter" | "colouring" | "blank" | "thank_you";
  /** Which front-matter page (when kind === "front_matter"). */
  frontMatter?: FrontMatterKey;
  label: string;
  recto: boolean;
  /** For colouring slots. */
  art?: { pageId: string; title: string; processedImage: string };
}

export interface InteriorLayout {
  slots: InteriorSlot[];
  pageCount: number;
  approvedCount: number;
  unapprovedCount: number;
  warnings: string[];
  options: InteriorOptions;
}

export const FRONT_MATTER_LABELS: Record<FrontMatterKey, string> = {
  titlePage: "Title page",
  copyrightPage: "Copyright page",
  belongsToPage: "This Book Belongs To",
  testColourPage: "Colour test page",
};

const FM_INCLUDE_FLAG: Record<FrontMatterKey, keyof InteriorOptions> = {
  titlePage: "includeTitlePage",
  copyrightPage: "includeCopyrightPage",
  belongsToPage: "includeBelongsToPage",
  testColourPage: "includeTestColourPage",
};

function parseOptions(json: string): InteriorOptions {
  try {
    return { ...DEFAULT_INTERIOR_OPTIONS, ...JSON.parse(json) };
  } catch {
    return { ...DEFAULT_INTERIOR_OPTIONS };
  }
}

/** Enabled front-matter keys in the user's chosen order. */
export function orderedFrontMatter(options: InteriorOptions): FrontMatterKey[] {
  const order = [
    ...options.frontMatterOrder,
    // Robustness: enabled keys missing from a stale order go last.
    ...FRONT_MATTER_KEYS.filter((k) => !options.frontMatterOrder.includes(k)),
  ];
  return order.filter((key) => options[FM_INCLUDE_FLAG[key]] === true);
}

export async function computeInteriorLayout(
  projectId: string,
): Promise<InteriorLayout> {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new PageServiceError("Project not found", 404);
  const options = parseOptions(project.interiorOptions);

  const pages = await prisma.colouringPage.findMany({
    where: { projectId },
    orderBy: { pageNumber: "asc" },
  });
  const approved = pages.filter(
    (p) => p.approvalStatus === "approved" && p.processedImage,
  );

  const slots: InteriorSlot[] = [];
  const push = (slot: Omit<InteriorSlot, "pageNumber" | "recto">) => {
    const pageNumber = slots.length + 1;
    slots.push({ ...slot, pageNumber, recto: pageNumber % 2 === 1 });
  };

  for (const key of orderedFrontMatter(options)) {
    push({ kind: "front_matter", frontMatter: key, label: FRONT_MATTER_LABELS[key] });
  }

  const blankBehind = options.singleSided || options.blankPageBehindEach;

  // First colouring page must be recto (odd) in single-sided books.
  if (blankBehind && (slots.length + 1) % 2 === 0) {
    push({ kind: "blank", label: "Blank" });
  }

  for (const page of approved) {
    push({
      kind: "colouring",
      label: page.title,
      art: {
        pageId: page.id,
        title: page.title,
        processedImage: page.processedImage!,
      },
    });
    if (blankBehind) push({ kind: "blank", label: "Blank" });
  }

  if (options.includeThankYouPage) {
    push({ kind: "thank_you", label: "Thank-you page" });
  }

  const warnings: string[] = [];
  const unapproved = pages.length - approved.length;
  if (approved.length === 0) {
    warnings.push("No approved pages yet — approve pages in the Images tab before building.");
  }
  if (unapproved > 0) {
    warnings.push(
      `${unapproved} page${unapproved === 1 ? " is" : "s are"} not approved and will NOT be included.`,
    );
  }
  if (slots.length > 0 && slots.length < KDP_MIN_PAGE_COUNT) {
    warnings.push(
      `KDP paperbacks need at least ${KDP_MIN_PAGE_COUNT} pages — this book has ${slots.length}.`,
    );
  }
  if (slots.length > KDP_MAX_PAGE_COUNT_BW) {
    warnings.push(
      `KDP black-ink paperbacks allow at most ${KDP_MAX_PAGE_COUNT_BW} pages — this book has ${slots.length}.`,
    );
  }

  return {
    slots,
    pageCount: slots.length,
    approvedCount: approved.length,
    unapprovedCount: unapproved,
    warnings,
    options,
  };
}

export interface InteriorBuildResult {
  url: string;
  pageCount: number;
  bytes: number;
  builtAt: string;
}

export async function buildInterior(projectId: string): Promise<InteriorBuildResult> {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new PageServiceError("Project not found", 404);

  const layout = await computeInteriorLayout(projectId);
  if (layout.approvedCount === 0) {
    throw new PageServiceError(
      "No approved pages to include — approve pages in the Images tab first.",
      409,
    );
  }

  const storage = getImageStorage();
  const artwork = new Map<string, Buffer>();
  for (const slot of layout.slots) {
    if (slot.art) {
      artwork.set(slot.art.pageId, await storage.readBytes(slot.art.processedImage));
    }
  }

  const pdf = await buildInteriorPdf({
    title: project.title,
    subtitle: project.subtitle,
    author: project.author,
    layout,
    artwork,
  });

  const buildNumber =
    (await prisma.export.count({
      where: { projectId, type: "interior_pdf" },
    })) + 1;
  const url = await storage.put(
    `projects/${projectId}/exports/book-interior-v${buildNumber}.pdf`,
    pdf,
    "application/pdf",
  );
  const row = await prisma.export.create({
    data: { projectId, type: "interior_pdf", filePath: url },
  });
  await prisma.project.updateMany({
    where: { id: projectId, status: { in: ["generating", "reviewing", "plan_approved"] } },
    data: { status: "interior" },
  });

  return {
    url,
    pageCount: layout.pageCount,
    bytes: pdf.length,
    builtAt: row.createdAt.toISOString(),
  };
}

export async function latestInteriorExport(projectId: string) {
  const row = await prisma.export.findFirst({
    where: { projectId, type: "interior_pdf" },
    orderBy: { createdAt: "desc" },
  });
  return row
    ? { url: row.filePath, builtAt: row.createdAt.toISOString() }
    : null;
}
