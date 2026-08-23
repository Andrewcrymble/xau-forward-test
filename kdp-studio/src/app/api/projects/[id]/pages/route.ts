import { NextRequest, NextResponse } from "next/server";
import { addPage, listPages } from "@/lib/services/page-service";
import { pageAddSchema } from "@/lib/validation/page";
import { apiError } from "@/lib/api-helpers";
import type { ApiResponse, PageDto } from "@/lib/types";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse<ApiResponse<PageDto[]>>> {
  const { id } = await ctx.params;
  try {
    return NextResponse.json({ ok: true, data: await listPages(id) });
  } catch (err) {
    return apiError(`GET /api/projects/${id}/pages`, err);
  }
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse<ApiResponse<PageDto>>> {
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
  const parsed = pageAddSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  try {
    const page = await addPage(id, parsed.data);
    return NextResponse.json({ ok: true, data: page }, { status: 201 });
  } catch (err) {
    return apiError(`POST /api/projects/${id}/pages`, err);
  }
}
