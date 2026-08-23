import { NextRequest, NextResponse } from "next/server";
import { deletePage, updatePage } from "@/lib/services/page-service";
import { pageEditSchema } from "@/lib/validation/page";
import { apiError } from "@/lib/api-helpers";
import type { ApiResponse, PageDto } from "@/lib/types";

type RouteContext = { params: Promise<{ pageId: string }> };

export async function PATCH(
  req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse<ApiResponse<PageDto>>> {
  const { pageId } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }
  const parsed = pageEditSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  try {
    const page = await updatePage(pageId, parsed.data);
    return NextResponse.json({ ok: true, data: page });
  } catch (err) {
    return apiError(`PATCH /api/pages/${pageId}`, err);
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse<ApiResponse<{ deleted: true }>>> {
  const { pageId } = await ctx.params;
  try {
    await deletePage(pageId);
    return NextResponse.json({ ok: true, data: { deleted: true } });
  } catch (err) {
    return apiError(`DELETE /api/pages/${pageId}`, err);
  }
}
