import { NextRequest, NextResponse } from "next/server";
import { generateSeriesForNiche } from "@/lib/services/niche-service";
import { apiError } from "@/lib/api-helpers";
import type { ApiResponse, NicheIdeaDto } from "@/lib/types";

export const maxDuration = 120;

type Ctx = { params: Promise<{ nicheId: string }> };

export async function POST(
  _req: NextRequest,
  ctx: Ctx,
): Promise<NextResponse<ApiResponse<NicheIdeaDto>>> {
  const { nicheId } = await ctx.params;
  try {
    return NextResponse.json({ ok: true, data: await generateSeriesForNiche(nicheId) });
  } catch (err) {
    return apiError(`POST /api/niches/${nicheId}/series`, err);
  }
}
