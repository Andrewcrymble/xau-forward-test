import { NextRequest, NextResponse } from "next/server";
import { generatePlan } from "@/lib/services/page-service";
import { apiError } from "@/lib/api-helpers";
import type { ApiResponse, PageDto } from "@/lib/types";

// Plan generation can take a while for large books on real providers.
export const maxDuration = 120;

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse<ApiResponse<PageDto[]>>> {
  const { id } = await ctx.params;
  try {
    const body = await req.json().catch(() => ({}));
    const pages = await generatePlan(id, { force: body?.force === true });
    return NextResponse.json({ ok: true, data: pages });
  } catch (err) {
    return apiError(`POST /api/projects/${id}/plan/generate`, err);
  }
}
