import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getImageStorage } from "@/lib/storage";
import {
  BibleSettings,
  BookConcept,
  CbnSettings,
  ColouringMode,
  DEFAULT_BIBLE_SETTINGS,
  DEFAULT_CBN_SETTINGS,
  DEFAULT_INTERIOR_OPTIONS,
  InteriorOptions,
  ProjectDto,
  ProjectStatus,
} from "@/lib/types";
import {
  ProjectCreateInput,
  ProjectUpdateInput,
} from "@/lib/validation/project";

type ProjectWithCounts = Prisma.ProjectGetPayload<object> & {
  _pageCount?: number;
  _approvedPageCount?: number;
};

function parseInteriorOptions(json: string): InteriorOptions {
  try {
    return { ...DEFAULT_INTERIOR_OPTIONS, ...JSON.parse(json) };
  } catch {
    return { ...DEFAULT_INTERIOR_OPTIONS };
  }
}

function parseJson<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(fallback)
      ? (parsed as T)
      : ({ ...fallback, ...parsed } as T);
  } catch {
    return fallback;
  }
}

export function parseBookConcept(json: string | null): BookConcept | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as BookConcept;
  } catch {
    return null;
  }
}

function toDto(
  project: ProjectWithCounts,
  pageCount = 0,
  approvedPageCount = 0,
): ProjectDto {
  return {
    id: project.id,
    name: project.name,
    title: project.title,
    subtitle: project.subtitle,
    author: project.author,
    niche: project.niche,
    subNiche: project.subNiche,
    specificAngle: project.specificAngle,
    description: project.description,
    emotionalTones: parseJson<string[]>(project.emotionalTones, []),
    artworkTheme: project.artworkTheme,
    bookConcept: parseBookConcept(project.bookConcept),
    colouringMode: project.colouringMode as ColouringMode,
    cbnSettings: parseJson<CbnSettings>(project.cbnSettings, { ...DEFAULT_CBN_SETTINGS }),
    bibleSettings: parseJson<BibleSettings>(project.bibleSettings, { ...DEFAULT_BIBLE_SETTINGS }),
    targetAudience: project.targetAudience,
    customAudience: project.customAudience,
    trimSize: project.trimSize,
    numberOfDesigns: project.numberOfDesigns,
    style: project.style,
    customStyle: project.customStyle,
    complexity: project.complexity,
    complexityOverridden: project.complexityOverridden,
    interiorOptions: parseInteriorOptions(project.interiorOptions),
    status: project.status as ProjectStatus,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    pageCount,
    approvedPageCount,
  };
}

export async function listProjects(): Promise<ProjectDto[]> {
  const projects = await prisma.project.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      pages: { select: { approvalStatus: true } },
    },
  });
  return projects.map((p) =>
    toDto(
      p,
      p.pages.length,
      p.pages.filter((pg) => pg.approvalStatus === "approved").length,
    ),
  );
}

export async function getProject(id: string): Promise<ProjectDto | null> {
  const project = await prisma.project.findUnique({
    where: { id },
    include: { pages: { select: { approvalStatus: true } } },
  });
  if (!project) return null;
  return toDto(
    project,
    project.pages.length,
    project.pages.filter((pg) => pg.approvalStatus === "approved").length,
  );
}

export async function createProject(input: ProjectCreateInput): Promise<ProjectDto> {
  const project = await prisma.project.create({
    data: {
      name: input.name,
      title: input.title,
      subtitle: input.subtitle ?? null,
      author: input.author ?? null,
      niche: input.niche,
      subNiche: input.subNiche ?? null,
      specificAngle: input.specificAngle ?? null,
      description: input.description ?? null,
      emotionalTones: JSON.stringify(input.emotionalTones ?? []),
      artworkTheme: input.artworkTheme ?? null,
      colouringMode: input.colouringMode ?? "standard",
      cbnSettings: JSON.stringify(input.cbnSettings ?? {}),
      bibleSettings: JSON.stringify(input.bibleSettings ?? {}),
      targetAudience: input.targetAudience,
      customAudience: input.customAudience ?? null,
      trimSize: input.trimSize,
      numberOfDesigns: input.numberOfDesigns,
      style: input.style,
      customStyle: input.customStyle ?? null,
      complexity: input.complexity,
      complexityOverridden: input.complexityOverridden ?? false,
      interiorOptions: JSON.stringify(input.interiorOptions),
      status: "setup",
    },
  });
  return toDto(project);
}

export async function updateProject(
  id: string,
  input: ProjectUpdateInput,
): Promise<ProjectDto | null> {
  const { interiorOptions, emotionalTones, cbnSettings, bibleSettings, ...rest } = input;
  const data: Prisma.ProjectUpdateInput = { ...rest };
  if (interiorOptions !== undefined) {
    data.interiorOptions = JSON.stringify(interiorOptions);
  }
  if (emotionalTones !== undefined) data.emotionalTones = JSON.stringify(emotionalTones);
  if (cbnSettings !== undefined) data.cbnSettings = JSON.stringify(cbnSettings);
  if (bibleSettings !== undefined) data.bibleSettings = JSON.stringify(bibleSettings);
  try {
    await prisma.project.update({ where: { id }, data });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025" // record not found
    ) {
      return null;
    }
    throw err;
  }
  return getProject(id);
}

export async function deleteProject(id: string): Promise<boolean> {
  try {
    await prisma.project.delete({ where: { id } });
    // Best-effort: remove the project's stored files (images, PDFs, ZIPs).
    try {
      const storage = getImageStorage();
      for (const f of await storage.list(`projects/${id}/`)) {
        await storage.delete(f.url);
      }
    } catch {
      // Leftovers are swept up by Settings → Free up storage.
    }
    return true;
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      return false;
    }
    throw err;
  }
}
