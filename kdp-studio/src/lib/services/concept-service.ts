import { prisma } from "@/lib/db";
import { getTextProvider } from "@/lib/ai";
import {
  audiencePromptText,
  complexityPromptText,
  stylePromptText,
  tonesPromptText,
} from "@/lib/config/book-options";
import { PageServiceError } from "@/lib/services/page-service";
import { parseBookConcept } from "@/lib/services/project-service";
import type { BookConcept, BookStyleProfile } from "@/lib/types";

// BUILD MY BOOK CONCEPT — turns the niche/audience/tone/artwork inputs into
// a persistent creative brief + Book Style Profile, stored on the project
// and injected into every image-generation prompt from then on.

export async function buildBookConcept(projectId: string): Promise<BookConcept> {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new PageServiceError("Project not found", 404);

  let tones: string[] = [];
  try {
    tones = JSON.parse(project.emotionalTones || "[]");
  } catch {
    tones = [];
  }

  const provider = getTextProvider();
  const { concept, usage } = await provider.generateBookConcept({
    niche: project.niche,
    subNiche: project.subNiche,
    specificAngle: project.specificAngle,
    description: project.description,
    audience: audiencePromptText(project.targetAudience, project.customAudience),
    tones: tonesPromptText(tones),
    artworkTheme: project.artworkTheme,
    style: stylePromptText(project.style, project.customStyle),
    complexity: complexityPromptText(project.complexity),
    pageCount: project.numberOfDesigns,
    colouringMode: project.colouringMode,
  });

  const stored: BookConcept = {
    creativeBrief: concept.creativeBrief,
    styleProfile: concept.styleProfile,
    builtAt: new Date().toISOString(),
  };
  await prisma.project.update({
    where: { id: projectId },
    data: { bookConcept: JSON.stringify(stored) },
  });
  await prisma.generationLog.create({
    data: {
      projectId,
      kind: "book_concept",
      provider: usage.provider,
      model: usage.model,
      tokensUsed: usage.tokensUsed ?? null,
      message: "Book concept + style profile built",
    },
  });
  return stored;
}

/** Manual edits to the brief / style profile — everything stays editable. */
export async function updateBookConcept(
  projectId: string,
  input: { creativeBrief?: string; styleProfile?: Partial<BookStyleProfile> },
): Promise<BookConcept> {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new PageServiceError("Project not found", 404);
  const current = parseBookConcept(project.bookConcept);
  if (!current) {
    throw new PageServiceError("Build the book concept first.", 409);
  }
  const updated: BookConcept = {
    creativeBrief: input.creativeBrief ?? current.creativeBrief,
    styleProfile: { ...current.styleProfile, ...(input.styleProfile ?? {}) },
    builtAt: current.builtAt,
  };
  await prisma.project.update({
    where: { id: projectId },
    data: { bookConcept: JSON.stringify(updated) },
  });
  return updated;
}
