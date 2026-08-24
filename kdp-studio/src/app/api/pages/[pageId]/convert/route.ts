import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { convertPageType } from "@/lib/services/page-service";
import { apiError } from "@/lib/api-helpers";
import type { ApiResponse, PageDto } from "@/lib/types";

type Ctx = { params: Promise<{ pageId: string }> };

const bodySchema = z.object({
  pageType: z.enum(["standard", "colour_by_numbers"]),
});

export async function POST(
  req: NextRequest,
  ctx: Ctx,
): Promise<NextResponse<ApiResponse<PageDto>>> {
  const { pageId } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  try {
    return NextResponse.json({
      ok: true,
      data: await convertPageType(pageId, parsed.data.pageType),
    });
  } catch (err) {
    return apiError(`POST /api/pages/${pageId}/convert`, err);
  }
}
