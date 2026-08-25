import { NextRequest, NextResponse } from "next/server";
import { scanEtsyMarket } from "@/lib/services/etsy-service";
import { apiError } from "@/lib/api-helpers";
import type { ApiResponse, NicheIdeaDto } from "@/lib/types";

export const maxDuration = 60;

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ nicheId: string }> },
): Promise<NextResponse<ApiResponse<NicheIdeaDto>>> {
  const { nicheId } = await ctx.params;
  try {
    return NextResponse.json({ ok: true, data: await scanEtsyMarket(nicheId) });
  } catch (err) {
    return apiError(`POST /api/niches/${nicheId}/etsy-scan`, err);
  }
}
