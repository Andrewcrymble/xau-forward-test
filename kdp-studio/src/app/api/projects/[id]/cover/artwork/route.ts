import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  generateCoverArtwork,
  selectCoverArtwork,
} from "@/lib/services/cover-service";
import { apiError } from "@/lib/api-helpers";
import type { ApiResponse, CoverDto } from "@/lib/types";

export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

/** POST with empty body = generate; POST {select: url} = choose a version. */
export async function POST(
  req: NextRequest,
  ctx: Ctx,
): Promise<NextResponse<ApiResponse<CoverDto>>> {
  const { id } = await ctx.params;
  let body: unknown = {};
  try {
    const text = await req.text();
    body = text ? JSON.parse(text) : {};
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }
  const parsed = z.object({ select: z.string().optional() }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Validation failed" },
      { status: 400 },
    );
  }
  try {
    const data = parsed.data.select
      ? await selectCoverArtwork(id, parsed.data.select)
      : await generateCoverArtwork(id);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return apiError(`POST /api/projects/${id}/cover/artwork`, err);
  }
}
