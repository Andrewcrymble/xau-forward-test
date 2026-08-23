import { NextRequest, NextResponse } from "next/server";
import { listVersions, type VersionDto } from "@/lib/services/image-service";
import { apiError } from "@/lib/api-helpers";
import type { ApiResponse } from "@/lib/types";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ pageId: string }> },
): Promise<NextResponse<ApiResponse<VersionDto[]>>> {
  const { pageId } = await ctx.params;
  try {
    const versions = await listVersions(pageId);
    return NextResponse.json({ ok: true, data: versions });
  } catch (err) {
    return apiError(`GET /api/pages/${pageId}/versions`, err);
  }
}
