import { prisma } from "@/lib/db";
import { getTextProvider } from "@/lib/ai";
import { PageServiceError } from "@/lib/services/page-service";
import {
  audiencePromptText,
  stylePromptText,
} from "@/lib/config/book-options";
import type { ListingContent } from "@/lib/types";
import type { ListingUpdateBody } from "@/lib/validation/listing";

function parseListing(json: string | null): ListingContent | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as ListingContent;
    // Listings saved before newer fields shipped lack them.
    parsed.categories ??= [];
    parsed.authorNote ??= "";
    parsed.insideBook ??= [];
    parsed.launchPlan ??= [];
    parsed.etsyTitle ??= "";
    parsed.etsyTags ??= [];
    parsed.etsyDescription ??= "";
    return parsed;
  } catch {
    return null;
  }
}

async function requireProject(projectId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new PageServiceError("Project not found", 404);
  return project;
}

export async function getListing(projectId: string): Promise<ListingContent | null> {
  const project = await requireProject(projectId);
  return parseListing(project.listing);
}

export async function generateListing(projectId: string): Promise<ListingContent> {
  const project = await requireProject(projectId);
  const pages = await prisma.colouringPage.findMany({
    where: { projectId },
    orderBy: { pageNumber: "asc" },
    select: { title: true },
    take: 15,
  });

  const provider = getTextProvider();
  const { listing, usage } = await provider.generateListing({
    bookTitle: project.title,
    subtitle: project.subtitle,
    author: project.author,
    niche: project.niche,
    description: project.description,
    audience: audiencePromptText(project.targetAudience, project.customAudience),
    style: stylePromptText(project.style, project.customStyle),
    pageCount: project.numberOfDesigns,
    pageTitles: pages.map((p) => p.title),
  });

  await prisma.project.update({
    where: { id: projectId },
    data: {
      listing: JSON.stringify(listing),
      ...(["cover", "interior", "generating", "reviewing", "plan_approved"].includes(project.status)
        ? { status: "listing" }
        : {}),
    },
  });
  await prisma.generationLog.create({
    data: {
      projectId,
      kind: "listing",
      provider: usage.provider,
      model: usage.model,
      tokensUsed: usage.tokensUsed ?? null,
    },
  });
  return listing;
}

export async function updateListing(
  projectId: string,
  input: ListingUpdateBody,
): Promise<ListingContent> {
  const project = await requireProject(projectId);
  const current = parseListing(project.listing);
  if (!current) {
    throw new PageServiceError("Generate the listing before editing it.", 409);
  }
  const merged: ListingContent = { ...current, ...input };
  await prisma.project.update({
    where: { id: projectId },
    data: { listing: JSON.stringify(merged) },
  });
  return merged;
}

/** Copy the listing's back-cover description onto the cover. */
export async function applyBackCoverText(projectId: string): Promise<void> {
  const project = await requireProject(projectId);
  const listing = parseListing(project.listing);
  if (!listing?.backCoverDescription) {
    throw new PageServiceError("The listing has no back-cover description yet.", 409);
  }
  await prisma.cover.upsert({
    where: { projectId },
    create: {
      projectId,
      title: project.title,
      subtitle: project.subtitle,
      author: project.author,
      backCoverText: listing.backCoverDescription,
    },
    update: { backCoverText: listing.backCoverDescription },
  });
}
