import { NextRequest, NextResponse } from "next/server";
import { replaceConcept } from "@/lib/services/page-service";
import { apiError } from "@/lib/api-helpers";
import type { ApiResponse, PageDto } from "@/lib/types";

export const maxDuration = 60;

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ pageId: string }> },
): Promise<NextResponse<ApiResponse<PageDto>>> {
  const { pageId } = await ctx.params;
  try {
    const page = await replaceConcept(pageId);
    return NextResponse.json({ ok: true, data: page });
  } catch (err) {
    return apiError(`POST /api/pages/${pageId}/replace`, err);
  }
}
