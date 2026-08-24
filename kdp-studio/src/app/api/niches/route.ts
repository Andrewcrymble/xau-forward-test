import { NextRequest, NextResponse } from "next/server";
import { listNicheIdeas } from "@/lib/services/niche-service";
import { apiError } from "@/lib/api-helpers";
import { NICHE_STATUSES, type ApiResponse, type NicheIdeaDto, type NicheStatus } from "@/lib/types";

export async function GET(
  req: NextRequest,
): Promise<NextResponse<ApiResponse<NicheIdeaDto[]>>> {
  try {
    const status = req.nextUrl.searchParams.get("status");
    const valid = NICHE_STATUSES.includes(status as NicheStatus)
      ? (status as NicheStatus)
      : undefined;
    return NextResponse.json({
      ok: true,
      data: await listNicheIdeas(valid ? { status: valid } : undefined),
    });
  } catch (err) {
    return apiError("GET /api/niches", err);
  }
}
