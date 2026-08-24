import { Prisma, type ColouringPage } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getImageStorage } from "@/lib/storage";
import { getTextProvider } from "@/lib/ai";
import type { TextUsage } from "@/lib/ai/types";
import { buildColouringPagePrompt } from "@/lib/config/colouring-rules";
import {
  BIBLE_TRANSLATIONS,
  VERSE_THEMES,
  audiencePromptText,
  complexityPromptText,
  stylePromptText,
  tonesPromptText,
} from "@/lib/config/book-options";
import { parseBookConcept } from "@/lib/services/project-service";
import {
  DEFAULT_BIBLE_SETTINGS,
  DEFAULT_CBN_SETTINGS,
  type ApprovalStatus,
  type BibleSettings,
  type CbnSettings,
  type GenerationStatus,
  type PageDto,
  type ValidationStatus,
} from "@/lib/types";

/** Cap how many sibling titles are baked into each prompt for de-duplication. */
const MAX_SIBLING_TITLES_IN_PROMPT = 60;

function toDto(p: ColouringPage): PageDto {
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
    generationStatus: p.generationStatus as GenerationStatus,
    approvalStatus: p.approvalStatus as ApprovalStatus,
    validationStatus: p.validationStatus as ValidationStatus,
    validationIssues: p.validationIssues,
    generationAttempts: p.generationAttempts,
    notes: p.notes,
  };
}

type ProjectForPrompts = {
  id: string;
  niche: string;
  subNiche: string | null;
  specificAngle: string | null;
  description: string | null;
  emotionalTones: string;
  artworkTheme: string | null;
  bookConcept: string | null;
  colouringMode: string;
  cbnSettings: string;
  bibleSettings: string;
  targetAudience: string;
  customAudience: string | null;
  style: string;
  customStyle: string | null;
  complexity: string;
  numberOfDesigns: number;
};

async function requireProject(projectId: string): Promise<ProjectForPrompts> {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new PageServiceError("Project not found", 404);
  return project;
}

export class PageServiceError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

function parseTones(project: ProjectForPrompts): string {
  try {
    return tonesPromptText(JSON.parse(project.emotionalTones || "[]"));
  } catch {
    return "";
  }
}

function parseBible(project: ProjectForPrompts): BibleSettings {
  try {
    return { ...DEFAULT_BIBLE_SETTINGS, ...JSON.parse(project.bibleSettings || "{}") };
  } catch {
    return { ...DEFAULT_BIBLE_SETTINGS };
  }
}

function parseCbn(project: ProjectForPrompts): CbnSettings {
  try {
    return { ...DEFAULT_CBN_SETTINGS, ...JSON.parse(project.cbnSettings || "{}") };
  } catch {
    return { ...DEFAULT_CBN_SETTINGS };
  }
}

function composePrompt(
  project: ProjectForPrompts,
  concept: string,
  siblingTitles: string[],
  pageText?: string | null,
): string {
  const style = stylePromptText(project.style, project.customStyle);
  const complexity = complexityPromptText(project.complexity);
  const bookConcept = parseBookConcept(project.bookConcept);
  return buildColouringPagePrompt({
    styleInstruction: `${style}, ${complexity}`,
    audienceDescription: audiencePromptText(
      project.targetAudience,
      project.customAudience,
    ),
    pageConcept: concept,
    tones: parseTones(project),
    artworkTheme: project.artworkTheme,
    creativeBrief: bookConcept?.creativeBrief ?? null,
    styleProfile: bookConcept?.styleProfile ?? null,
    pageText: pageText ?? null,
    previousPageSummaries: siblingTitles.slice(0, MAX_SIBLING_TITLES_IN_PROMPT),
  });
}

/** Common fields for plan/replacement requests to the text provider. */
function planRequestBase(project: ProjectForPrompts) {
  const bible = parseBible(project);
  const bookConcept = parseBookConcept(project.bookConcept);
  return {
    niche: project.niche,
    subNiche: project.subNiche,
    specificAngle: project.specificAngle,
    description: project.description,
    audience: audiencePromptText(project.targetAudience, project.customAudience),
    style: stylePromptText(project.style, project.customStyle),
    complexity: complexityPromptText(project.complexity),
    tones: parseTones(project),
    artworkTheme: project.artworkTheme,
    creativeBrief: bookConcept?.creativeBrief ?? null,
    bible: bible.enabled
      ? {
          translation:
            BIBLE_TRANSLATIONS.find((t) => t.id === bible.translation)?.label.split(" (")[0] ??
            bible.translation.toUpperCase(),
          themes: bible.themes
            .map((id) => VERSE_THEMES.find((t) => t.id === id)?.label)
            .filter((l): l is string => !!l),
          includeVerseText: bible.includeVerseText,
          includeReference: bible.includeReference,
        }
      : null,
  };
}

/** Standing note attached to every AI-supplied scripture page. */
export const SCRIPTURE_VERIFY_NOTE =
  "Scripture wording generated by AI — verify the exact text and reference against a printed copy of the selected translation before publishing, and check the translation's licensing terms for commercial use.";

async function logUsage(projectId: string, kind: string, usage: TextUsage) {
  await prisma.generationLog.create({
    data: {
      projectId,
      kind,
      provider: usage.provider,
      model: usage.model,
      tokensUsed: usage.tokensUsed ?? null,
    },
  });
}

export async function listPages(projectId: string): Promise<PageDto[]> {
  const pages = await prisma.colouringPage.findMany({
    where: { projectId },
    orderBy: { pageNumber: "asc" },
  });
  return pages.map(toDto);
}

/**
 * Generate the full book plan. Refuses to overwrite a plan that already has
 * generated or approved artwork; otherwise replaces existing concepts.
 */
export async function generatePlan(projectId: string): Promise<PageDto[]> {
  const project = await requireProject(projectId);

  const existing = await prisma.colouringPage.findMany({ where: { projectId } });
  const hasWork = existing.some(
    (p) => p.originalImage || p.approvalStatus === "approved",
  );
  if (hasWork) {
    throw new PageServiceError(
      "This project already has generated or approved pages. Delete those pages first if you really want a fresh plan.",
      409,
    );
  }

  const provider = getTextProvider();
  const cbn = parseCbn(project);
  const cbnCount =
    project.colouringMode === "colour_by_numbers"
      ? project.numberOfDesigns
      : project.colouringMode === "mixed"
        ? Math.min(cbn.cbnPageCount, project.numberOfDesigns)
        : 0;
  const { concepts, usage } = await provider.generateBookPlan({
    ...planRequestBase(project),
    count: project.numberOfDesigns,
    cbnCount,
  });

  // Whole-book CBN mode: every page is colour-by-numbers regardless of what
  // the model marked.
  if (project.colouringMode === "colour_by_numbers") {
    for (const c of concepts) c.pageType = "colour_by_numbers";
  }

  const titles = concepts.map((c) => c.title);
  await prisma.$transaction([
    prisma.colouringPage.deleteMany({ where: { projectId } }),
    prisma.colouringPage.createMany({
      data: concepts.map((c, i) => ({
        projectId,
        pageNumber: i + 1,
        title: c.title,
        concept: c.concept,
        pageType: c.pageType === "colour_by_numbers" ? "colour_by_numbers" : "standard",
        pageText: c.pageText ?? null,
        notes: c.pageText ? SCRIPTURE_VERIFY_NOTE : null,
        prompt: composePrompt(
          project,
          c.concept,
          titles.filter((t) => t !== c.title),
          c.pageText,
        ),
      })),
    }),
    prisma.project.update({
      where: { id: projectId },
      data: { status: "planning" },
    }),
  ]);
  await logUsage(projectId, "book_plan", usage);

  return listPages(projectId);
}

export interface PageEditInput {
  title?: string;
  concept?: string;
  prompt?: string;
  notes?: string | null;
}

export async function updatePage(
  pageId: string,
  input: PageEditInput,
): Promise<PageDto> {
  const page = await prisma.colouringPage.findUnique({ where: { id: pageId } });
  if (!page) throw new PageServiceError("Page not found", 404);
  const project = await requireProject(page.projectId);

  const data: Prisma.ColouringPageUpdateInput = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.notes !== undefined) data.notes = input.notes;

  if (input.prompt !== undefined && input.prompt !== page.prompt) {
    // Manual prompt edit wins and stops future auto-rebuilds.
    data.prompt = input.prompt;
    data.promptEdited = true;
  }

  if (input.concept !== undefined && input.concept !== page.concept) {
    data.concept = input.concept;
    // Concept changed: rebuild the prompt unless the user owns it.
    if (input.prompt === undefined && !page.promptEdited) {
      const siblings = await prisma.colouringPage.findMany({
        where: { projectId: page.projectId, NOT: { id: pageId } },
        select: { title: true },
        orderBy: { pageNumber: "asc" },
      });
      data.prompt = composePrompt(
        project,
        input.concept,
        siblings.map((s) => s.title),
      );
    }
  }

  const updated = await prisma.colouringPage.update({
    where: { id: pageId },
    data,
  });
  return toDto(updated);
}

/** Add a new concept at the end of the plan (manually written). */
export async function addPage(
  projectId: string,
  input: { title: string; concept: string },
): Promise<PageDto> {
  const project = await requireProject(projectId);
  const siblings = await prisma.colouringPage.findMany({
    where: { projectId },
    select: { title: true, pageNumber: true },
    orderBy: { pageNumber: "asc" },
  });
  const nextNumber = (siblings.at(-1)?.pageNumber ?? 0) + 1;
  const page = await prisma.colouringPage.create({
    data: {
      projectId,
      pageNumber: nextNumber,
      title: input.title,
      concept: input.concept,
      prompt: composePrompt(
        project,
        input.concept,
        siblings.map((s) => s.title),
      ),
    },
  });
  return toDto(page);
}

/** Replace one page's concept with a freshly AI-generated one. */
export async function replaceConcept(pageId: string): Promise<PageDto> {
  const page = await prisma.colouringPage.findUnique({ where: { id: pageId } });
  if (!page) throw new PageServiceError("Page not found", 404);
  if (page.approvalStatus === "approved") {
    throw new PageServiceError(
      "This page is approved — un-approve it before replacing its concept.",
      409,
    );
  }
  const project = await requireProject(page.projectId);
  const siblings = await prisma.colouringPage.findMany({
    where: { projectId: page.projectId, NOT: { id: pageId } },
    select: { title: true },
    orderBy: { pageNumber: "asc" },
  });

  const provider = getTextProvider();
  const { concept, usage } = await provider.generateReplacementConcept({
    ...planRequestBase(project),
    cbnCount: page.pageType === "colour_by_numbers" ? 1 : 0,
    avoidTitles: siblings.map((s) => s.title),
  });
  await logUsage(project.id, "concept_replace", usage);

  const updated = await prisma.colouringPage.update({
    where: { id: pageId },
    data: {
      title: concept.title,
      concept: concept.concept,
      pageText: concept.pageText ?? null,
      notes: concept.pageText ? SCRIPTURE_VERIFY_NOTE : page.notes,
      prompt: composePrompt(
        project,
        concept.concept,
        siblings.map((s) => s.title),
        concept.pageText,
      ),
      promptEdited: false,
    },
  });
  return toDto(updated);
}

/** Duplicate a page's concept directly after it (no artwork is copied). */
export async function duplicatePage(pageId: string): Promise<PageDto> {
  const page = await prisma.colouringPage.findUnique({ where: { id: pageId } });
  if (!page) throw new PageServiceError("Page not found", 404);
  const project = await requireProject(page.projectId);
  const siblings = await prisma.colouringPage.findMany({
    where: { projectId: page.projectId },
    select: { id: true, title: true, pageNumber: true },
    orderBy: { pageNumber: "asc" },
  });
  const title = `${page.title} (copy)`;
  const created = await prisma.colouringPage.create({
    data: {
      projectId: page.projectId,
      pageNumber: siblings.length + 1,
      title,
      concept: page.concept,
      pageType: page.pageType,
      pageText: page.pageText,
      notes: page.notes,
      prompt: composePrompt(
        project,
        page.concept,
        siblings.map((s) => s.title),
        page.pageText,
      ),
    },
  });
  // Slot the copy directly after the original.
  const order = siblings.map((s) => s.id);
  order.splice(order.indexOf(pageId) + 1, 0, created.id);
  await reorderPages(page.projectId, order);
  const fresh = await prisma.colouringPage.findUnique({ where: { id: created.id } });
  return toDto(fresh!);
}

/** Switch a page between standard and colour-by-numbers. */
export async function convertPageType(
  pageId: string,
  pageType: "standard" | "colour_by_numbers",
): Promise<PageDto> {
  const page = await prisma.colouringPage.findUnique({ where: { id: pageId } });
  if (!page) throw new PageServiceError("Page not found", 404);
  if (page.approvalStatus === "approved") {
    throw new PageServiceError(
      "This page is approved — un-approve it before converting its type.",
      409,
    );
  }
  const updated = await prisma.colouringPage.update({
    where: { id: pageId },
    data: {
      pageType,
      // Old CBN artefacts no longer apply after conversion.
      ...(pageType === "standard" ? { cbnData: null, completedReference: null } : {}),
    },
  });
  return toDto(updated);
}

/** Delete a page and renumber the remainder contiguously. */
export async function deletePage(pageId: string): Promise<void> {
  const page = await prisma.colouringPage.findUnique({ where: { id: pageId } });
  if (!page) throw new PageServiceError("Page not found", 404);
  await prisma.colouringPage.delete({ where: { id: pageId } });
  // Best-effort: free the page's stored images straight away.
  try {
    const storage = getImageStorage();
    for (const f of await storage.list(`projects/${page.projectId}/pages/${pageId}/`)) {
      await storage.delete(f.url);
    }
  } catch {
    // Leftovers are swept up by Settings → Free up storage.
  }
  await renumber(page.projectId);
}

/** Apply a complete new ordering (array of page ids, first = page 1). */
export async function reorderPages(
  projectId: string,
  orderedIds: string[],
): Promise<PageDto[]> {
  const pages = await prisma.colouringPage.findMany({
    where: { projectId },
    select: { id: true },
  });
  const known = new Set(pages.map((p) => p.id));
  if (
    orderedIds.length !== pages.length ||
    !orderedIds.every((id) => known.has(id))
  ) {
    throw new PageServiceError(
      "Reorder list does not match the project's pages — refresh and try again.",
      409,
    );
  }
  // Two passes: temporary offsets first so unique (projectId, pageNumber)
  // pairs never collide mid-update.
  await prisma.$transaction([
    ...orderedIds.map((id, i) =>
      prisma.colouringPage.update({
        where: { id },
        data: { pageNumber: i + 1 + 100000 },
      }),
    ),
    ...orderedIds.map((id, i) =>
      prisma.colouringPage.update({
        where: { id },
        data: { pageNumber: i + 1 },
      }),
    ),
  ]);
  return listPages(projectId);
}

async function renumber(projectId: string): Promise<void> {
  const pages = await prisma.colouringPage.findMany({
    where: { projectId },
    orderBy: { pageNumber: "asc" },
    select: { id: true },
  });
  await prisma.$transaction(
    pages.map((p, i) =>
      prisma.colouringPage.update({
        where: { id: p.id },
        data: { pageNumber: i + 1 },
      }),
    ),
  );
}

/** Mark the plan approved so image generation can begin (Phase 3). */
export async function approvePlan(projectId: string): Promise<void> {
  await requireProject(projectId);
  const count = await prisma.colouringPage.count({ where: { projectId } });
  if (count === 0) {
    throw new PageServiceError("Generate a book plan before approving it.", 409);
  }
  await prisma.project.update({
    where: { id: projectId },
    data: { status: "plan_approved" },
  });
}
