import { NextRequest, NextResponse } from "next/server";
import { selectVersion } from "@/lib/services/image-service";
import { apiError } from "@/lib/api-helpers";
import type { ApiResponse, PageDto } from "@/lib/types";

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ pageId: string; versionId: string }> },
): Promise<NextResponse<ApiResponse<PageDto>>> {
  const { pageId, versionId } = await ctx.params;
  try {
    const page = await selectVersion(pageId, versionId);
    return NextResponse.json({ ok: true, data: page });
  } catch (err) {
    return apiError(`POST /api/pages/${pageId}/versions/${versionId}/select`, err);
  }
}
