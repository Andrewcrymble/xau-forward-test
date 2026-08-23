import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
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
    niche: project.niche,
    description: project.description,
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
      niche: input.niche,
      description: input.description ?? null,
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
  const { interiorOptions, ...rest } = input;
  const data: Prisma.ProjectUpdateInput = { ...rest };
  if (interiorOptions !== undefined) {
    data.interiorOptions = JSON.stringify(interiorOptions);
  }
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
