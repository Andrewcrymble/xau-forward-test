import { NextRequest, NextResponse } from "next/server";
import { runBookQualityCheck, type QualityReport } from "@/lib/services/quality-service";
import { apiError } from "@/lib/api-helpers";
import type { ApiResponse } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(
  _req: NextRequest,
  ctx: Ctx,
): Promise<NextResponse<ApiResponse<QualityReport>>> {
  const { id } = await ctx.params;
  try {
    return NextResponse.json({ ok: true, data: await runBookQualityCheck(id) });
  } catch (err) {
    return apiError(`POST /api/projects/${id}/quality`, err);
  }
}
