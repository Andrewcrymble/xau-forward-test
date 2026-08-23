import { NextRequest, NextResponse } from "next/server";
import {
  deleteProject,
  getProject,
  updateProject,
} from "@/lib/services/project-service";
import { projectUpdateSchema } from "@/lib/validation/project";
import type { ApiResponse, ProjectDto } from "@/lib/types";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(
  _req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse<ApiResponse<ProjectDto>>> {
  const { id } = await ctx.params;
  try {
    const project = await getProject(id);
    if (!project) {
      return NextResponse.json(
        { ok: false, error: "Project not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, data: project });
  } catch (err) {
    console.error(`GET /api/projects/${id} failed:`, err);
    return NextResponse.json(
      { ok: false, error: "Failed to load project" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse<ApiResponse<ProjectDto>>> {
  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const parsed = projectUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const project = await updateProject(id, parsed.data);
    if (!project) {
      return NextResponse.json(
        { ok: false, error: "Project not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, data: project });
  } catch (err) {
    console.error(`PATCH /api/projects/${id} failed:`, err);
    return NextResponse.json(
      { ok: false, error: "Failed to update project" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse<ApiResponse<{ deleted: true }>>> {
  const { id } = await ctx.params;
  try {
    const deleted = await deleteProject(id);
    if (!deleted) {
      return NextResponse.json(
        { ok: false, error: "Project not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, data: { deleted: true } });
  } catch (err) {
    console.error(`DELETE /api/projects/${id} failed:`, err);
    return NextResponse.json(
      { ok: false, error: "Failed to delete project" },
      { status: 500 },
    );
  }
}
