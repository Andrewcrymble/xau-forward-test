import { NextRequest, NextResponse } from "next/server";
import { buildEtsyPack, type PackageBuildResult } from "@/lib/services/export-service";
import { apiError } from "@/lib/api-helpers";
import type { ApiResponse } from "@/lib/types";

// Building the pack embeds every approved page into the print-at-home PDF.
export const maxDuration = 300;

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse<ApiResponse<PackageBuildResult>>> {
  const { id } = await ctx.params;
  try {
    return NextResponse.json({ ok: true, data: await buildEtsyPack(id) });
  } catch (err) {
    return apiError(`POST /api/projects/${id}/export/etsy`, err);
  }
}
