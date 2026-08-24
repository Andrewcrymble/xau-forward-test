import { NextRequest, NextResponse } from "next/server";
import {
  buildKdpPackage,
  type PackageBuildResult,
} from "@/lib/services/export-service";
import { apiError } from "@/lib/api-helpers";
import type { ApiResponse } from "@/lib/types";

// Assembling the package downloads every approved image plus both PDFs.
export const maxDuration = 300;

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse<ApiResponse<PackageBuildResult>>> {
  const { id } = await ctx.params;
  try {
    return NextResponse.json({ ok: true, data: await buildKdpPackage(id) });
  } catch (err) {
    return apiError(`POST /api/projects/${id}/export/package`, err);
  }
}
