import { NextRequest, NextResponse } from "next/server";
import { buildCover, type CoverBuildResult } from "@/lib/services/cover-service";
import { apiError } from "@/lib/api-helpers";
import type { ApiResponse } from "@/lib/types";

export const maxDuration = 300;

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse<ApiResponse<CoverBuildResult>>> {
  const { id } = await ctx.params;
  try {
    return NextResponse.json({ ok: true, data: await buildCover(id) });
  } catch (err) {
    return apiError(`POST /api/projects/${id}/cover/build`, err);
  }
}
