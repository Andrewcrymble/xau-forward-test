import { NextRequest, NextResponse } from "next/server";
import { reorderPages } from "@/lib/services/page-service";
import { reorderSchema } from "@/lib/validation/page";
import { apiError } from "@/lib/api-helpers";
import type { ApiResponse, PageDto } from "@/lib/types";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse<ApiResponse<PageDto[]>>> {
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
  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  try {
    const pages = await reorderPages(id, parsed.data.orderedIds);
    return NextResponse.json({ ok: true, data: pages });
  } catch (err) {
    return apiError(`POST /api/projects/${id}/pages/reorder`, err);
  }
}
