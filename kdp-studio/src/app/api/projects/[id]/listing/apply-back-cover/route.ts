import { NextRequest, NextResponse } from "next/server";
import { applyBackCoverText } from "@/lib/services/listing-service";
import { apiError } from "@/lib/api-helpers";
import type { ApiResponse } from "@/lib/types";

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse<ApiResponse<{ applied: true }>>> {
  const { id } = await ctx.params;
  try {
    await applyBackCoverText(id);
    return NextResponse.json({ ok: true, data: { applied: true } });
  } catch (err) {
    return apiError(`POST /api/projects/${id}/listing/apply-back-cover`, err);
  }
}
