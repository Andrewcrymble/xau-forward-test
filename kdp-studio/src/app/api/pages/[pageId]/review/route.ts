import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { reviewPage } from "@/lib/services/image-service";
import { apiError } from "@/lib/api-helpers";
import type { ApiResponse, PageDto } from "@/lib/types";

const reviewSchema = z.object({
  action: z.enum(["approve", "unapprove", "reject"]),
});

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ pageId: string }> },
): Promise<NextResponse<ApiResponse<PageDto>>> {
  const { pageId } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }
  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  try {
    const page = await reviewPage(pageId, parsed.data.action);
    return NextResponse.json({ ok: true, data: page });
  } catch (err) {
    return apiError(`POST /api/pages/${pageId}/review`, err);
  }
}
