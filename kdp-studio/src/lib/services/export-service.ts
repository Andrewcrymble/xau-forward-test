import JSZip from "jszip";
import { prisma } from "@/lib/db";
import { getImageStorage } from "@/lib/storage";
import { PageServiceError } from "@/lib/services/page-service";
import {
  buildInterior,
  latestInteriorExport,
} from "@/lib/services/interior-service";
import { buildCover, latestCoverExport } from "@/lib/services/cover-service";
import { getListing } from "@/lib/services/listing-service";
import type { ListingContent } from "@/lib/types";

// Phase 7: the complete KDP package.
//
//   project-name.zip
//   /project-name
//       /interior/book-interior.pdf
//       /cover/book-cover.pdf
//       /images/001.png …            (approved pages only)
//       /listing/amazon-listing.txt
//       project-details.json

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "colouring-book"
  );
}

function listingToText(listing: ListingContent): string {
  const lines: string[] = [
    "AMAZON KDP LISTING",
    "==================",
    "",
    `TITLE:`,
    listing.title,
    "",
    `SUBTITLE:`,
    listing.subtitle,
    "",
    "DESCRIPTION:",
    listing.description,
    "",
    "SALES POINTS:",
    ...listing.bulletPoints.map((b) => `- ${b}`),
    "",
    "KEYWORDS (7 backend slots):",
    ...listing.keywords.map((k, i) => `${i + 1}. ${k}`),
    "",
    "AUDIENCE:",
    listing.audience,
    "",
    "BACK-COVER DESCRIPTION:",
    listing.backCoverDescription,
    "",
    "SHORT PROMO:",
    listing.shortPromo,
    "",
    "Note: keyword and category suggestions do not guarantee Amazon ranking.",
  ];
  return lines.join("\n");
}

export interface ExportReadiness {
  totalPages: number;
  approvedPages: number;
  interiorBuilt: boolean;
  coverBuilt: boolean;
  listingReady: boolean;
  latestPackage: { url: string; builtAt: string } | null;
}

export async function getExportReadiness(projectId: string): Promise<ExportReadiness> {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new PageServiceError("Project not found", 404);
  const pages = await prisma.colouringPage.findMany({
    where: { projectId },
    select: { approvalStatus: true, processedImage: true },
  });
  const [interior, cover, listing, pkg] = await Promise.all([
    latestInteriorExport(projectId),
    latestCoverExport(projectId),
    getListing(projectId),
    prisma.export.findFirst({
      where: { projectId, type: "kdp_package" },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return {
    totalPages: pages.length,
    approvedPages: pages.filter((p) => p.approvalStatus === "approved" && p.processedImage).length,
    interiorBuilt: !!interior,
    coverBuilt: !!cover,
    listingReady: !!listing,
    latestPackage: pkg
      ? { url: pkg.filePath, builtAt: pkg.createdAt.toISOString() }
      : null,
  };
}

export interface PackageBuildResult {
  url: string;
  bytes: number;
  builtAt: string;
  contents: string[];
  imageCount: number;
}

export async function buildKdpPackage(projectId: string): Promise<PackageBuildResult> {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new PageServiceError("Project not found", 404);

  const approvedPages = await prisma.colouringPage.findMany({
    where: { projectId, approvalStatus: "approved", NOT: { processedImage: null } },
    orderBy: { pageNumber: "asc" },
  });
  if (approvedPages.length === 0) {
    throw new PageServiceError(
      "No approved pages — approve pages in the Images tab before exporting.",
      409,
    );
  }

  const storage = getImageStorage();

  // PDFs: reuse the most recent build, or build now when missing.
  let interiorRef = await latestInteriorExport(projectId);
  if (!interiorRef) {
    const built = await buildInterior(projectId);
    interiorRef = { url: built.url, builtAt: built.builtAt };
  }
  let coverRef = await latestCoverExport(projectId);
  if (!coverRef) {
    const built = await buildCover(projectId);
    coverRef = { url: built.url, builtAt: built.builtAt };
  }
  const listing = await getListing(projectId);

  const slug = slugify(project.name);
  const zip = new JSZip();
  const root = zip.folder(slug)!;
  const contents: string[] = [];

  root
    .folder("interior")!
    .file("book-interior.pdf", await storage.readBytes(interiorRef.url));
  contents.push(`${slug}/interior/book-interior.pdf`);

  root
    .folder("cover")!
    .file("book-cover.pdf", await storage.readBytes(coverRef.url));
  contents.push(`${slug}/cover/book-cover.pdf`);

  const images = root.folder("images")!;
  for (let i = 0; i < approvedPages.length; i++) {
    const name = `${String(i + 1).padStart(3, "0")}.png`;
    images.file(name, await storage.readBytes(approvedPages[i].processedImage!));
  }
  contents.push(
    `${slug}/images/001.png … ${String(approvedPages.length).padStart(3, "0")}.png`,
  );

  if (listing) {
    root.folder("listing")!.file("amazon-listing.txt", listingToText(listing));
    contents.push(`${slug}/listing/amazon-listing.txt`);
  }

  const details = {
    generatedAt: new Date().toISOString(),
    generator: "KDP Colouring Book Studio",
    project: {
      name: project.name,
      title: project.title,
      subtitle: project.subtitle,
      author: project.author,
      niche: project.niche,
      targetAudience: project.targetAudience,
      customAudience: project.customAudience,
      trimSize: project.trimSize,
      numberOfDesigns: project.numberOfDesigns,
      style: project.style,
      customStyle: project.customStyle,
      complexity: project.complexity,
      interiorOptions: JSON.parse(project.interiorOptions || "{}"),
    },
    approvedPages: approvedPages.map((p, i) => ({
      file: `${String(i + 1).padStart(3, "0")}.png`,
      pageNumber: p.pageNumber,
      title: p.title,
      concept: p.concept,
    })),
    listing,
  };
  root.file("project-details.json", JSON.stringify(details, null, 2));
  contents.push(`${slug}/project-details.json`);

  // PNGs and PDFs are already compressed — STORE keeps packaging fast.
  const buffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "STORE",
  });

  const buildNumber =
    (await prisma.export.count({ where: { projectId, type: "kdp_package" } })) + 1;
  const url = await storage.put(
    `projects/${projectId}/exports/${slug}-kdp-package-v${buildNumber}.zip`,
    buffer,
    "application/zip",
  );
  const row = await prisma.export.create({
    data: { projectId, type: "kdp_package", filePath: url },
  });
  await prisma.project.update({
    where: { id: projectId },
    data: { status: "complete" },
  });

  return {
    url,
    bytes: buffer.length,
    builtAt: row.createdAt.toISOString(),
    contents,
    imageCount: approvedPages.length,
  };
}
