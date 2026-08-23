import { NextRequest, NextResponse } from "next/server";
import { generatePageImage } from "@/lib/services/image-service";
import { apiError } from "@/lib/api-helpers";
import type { ApiResponse, PageDto } from "@/lib/types";

// Image generation can take a minute or two per page on real providers.
export const maxDuration = 300;

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ pageId: string }> },
): Promise<NextResponse<ApiResponse<PageDto>>> {
  const { pageId } = await ctx.params;
  try {
    const page = await generatePageImage(pageId);
    return NextResponse.json({ ok: true, data: page });
  } catch (err) {
    return apiError(`POST /api/pages/${pageId}/generate`, err);
  }
}
