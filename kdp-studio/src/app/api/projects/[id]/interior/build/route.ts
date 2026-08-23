import { NextRequest, NextResponse } from "next/server";
import {
  buildInterior,
  type InteriorBuildResult,
} from "@/lib/services/interior-service";
import { apiError } from "@/lib/api-helpers";
import type { ApiResponse } from "@/lib/types";

// Assembling a large book means fetching every approved image.
export const maxDuration = 300;

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse<ApiResponse<InteriorBuildResult>>> {
  const { id } = await ctx.params;
  try {
    const result = await buildInterior(id);
    return NextResponse.json({ ok: true, data: result });
  } catch (err) {
    return apiError(`POST /api/projects/${id}/interior/build`, err);
  }
}
