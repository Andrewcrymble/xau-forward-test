import { NextRequest, NextResponse } from "next/server";
import { setPageReference } from "@/lib/services/image-service";
import { apiError } from "@/lib/api-helpers";
import { PageServiceError } from "@/lib/services/page-service";
import type { ApiResponse, PageDto } from "@/lib/types";

// Per-page reference photo: the user uploads a real image (e.g. a mural
// photograph) and generation redraws THAT image as the colouring page.

export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ pageId: string }> },
): Promise<NextResponse<ApiResponse<PageDto>>> {
  const { pageId } = await ctx.params;
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof Blob) || file.size === 0) {
      throw new PageServiceError("No image file received.", 400);
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const page = await setPageReference(pageId, bytes);
    return NextResponse.json({ ok: true, data: page });
  } catch (err) {
    return apiError(`POST /api/pages/${pageId}/reference`, err);
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ pageId: string }> },
): Promise<NextResponse<ApiResponse<PageDto>>> {
  const { pageId } = await ctx.params;
  try {
    const page = await setPageReference(pageId, null);
    return NextResponse.json({ ok: true, data: page });
  } catch (err) {
    return apiError(`DELETE /api/pages/${pageId}/reference`, err);
  }
}
