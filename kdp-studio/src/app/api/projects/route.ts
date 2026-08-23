import { NextRequest, NextResponse } from "next/server";
import { createProject, listProjects } from "@/lib/services/project-service";
import { projectCreateSchema } from "@/lib/validation/project";
import type { ApiResponse } from "@/lib/types";
import type { ProjectDto } from "@/lib/types";

export async function GET(): Promise<NextResponse<ApiResponse<ProjectDto[]>>> {
  try {
    const projects = await listProjects();
    return NextResponse.json({ ok: true, data: projects });
  } catch (err) {
    console.error("GET /api/projects failed:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to load projects" },
      { status: 500 },
    );
  }
}

export async function POST(
  req: NextRequest,
): Promise<NextResponse<ApiResponse<ProjectDto>>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const parsed = projectCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const project = await createProject(parsed.data);
    return NextResponse.json({ ok: true, data: project }, { status: 201 });
  } catch (err) {
    console.error("POST /api/projects failed:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to create project" },
      { status: 500 },
    );
  }
}
