import { NextRequest, NextResponse } from "next/server";
import { approvePlan } from "@/lib/services/page-service";
import { apiError } from "@/lib/api-helpers";
import type { ApiResponse } from "@/lib/types";

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse<ApiResponse<{ approved: true }>>> {
  const { id } = await ctx.params;
  try {
    await approvePlan(id);
    return NextResponse.json({ ok: true, data: { approved: true } });
  } catch (err) {
    return apiError(`POST /api/projects/${id}/plan/approve`, err);
  }
}
