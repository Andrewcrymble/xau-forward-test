import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  generateCoverConcepts,
  selectCoverConcept,
} from "@/lib/services/cover-service";
import { apiError } from "@/lib/api-helpers";
import type { ApiResponse, CoverDto } from "@/lib/types";

export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

/** POST with empty body = develop 3 concepts; POST {select: index} = choose one. */
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
  const parsed = z
    .object({ select: z.number().int().min(0).optional() })
    .safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Validation failed" },
      { status: 400 },
    );
  }
  try {
    const data =
      parsed.data.select !== undefined
        ? await selectCoverConcept(id, parsed.data.select)
        : await generateCoverConcepts(id);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return apiError(`POST /api/projects/${id}/cover/concepts`, err);
  }
}
