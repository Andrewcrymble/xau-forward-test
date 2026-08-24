import { NextRequest, NextResponse } from "next/server";
import { generateListing } from "@/lib/services/listing-service";
import { apiError } from "@/lib/api-helpers";
import type { ApiResponse, ListingContent } from "@/lib/types";

export const maxDuration = 120;

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse<ApiResponse<ListingContent>>> {
  const { id } = await ctx.params;
  try {
    return NextResponse.json({ ok: true, data: await generateListing(id) });
  } catch (err) {
    return apiError(`POST /api/projects/${id}/listing/generate`, err);
  }
}
