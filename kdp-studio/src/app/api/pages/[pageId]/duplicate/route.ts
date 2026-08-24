import { NextRequest, NextResponse } from "next/server";
import { duplicatePage } from "@/lib/services/page-service";
import { apiError } from "@/lib/api-helpers";
import type { ApiResponse, PageDto } from "@/lib/types";

type Ctx = { params: Promise<{ pageId: string }> };

export async function POST(
  _req: NextRequest,
  ctx: Ctx,
): Promise<NextResponse<ApiResponse<PageDto>>> {
  const { pageId } = await ctx.params;
  try {
    return NextResponse.json({ ok: true, data: await duplicatePage(pageId) });
  } catch (err) {
    return apiError(`POST /api/pages/${pageId}/duplicate`, err);
  }
}
