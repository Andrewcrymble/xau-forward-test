import { NextRequest, NextResponse } from "next/server";
import { getCover, updateCover } from "@/lib/services/cover-service";
import { coverUpdateSchema } from "@/lib/validation/cover";
import { apiError } from "@/lib/api-helpers";
import type { ApiResponse, CoverDto } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(
  _req: NextRequest,
  ctx: Ctx,
): Promise<NextResponse<ApiResponse<CoverDto>>> {
  const { id } = await ctx.params;
  try {
    return NextResponse.json({ ok: true, data: await getCover(id) });
  } catch (err) {
    return apiError(`GET /api/projects/${id}/cover`, err);
  }
}

export async function PATCH(
  req: NextRequest,
  ctx: Ctx,
): Promise<NextResponse<ApiResponse<CoverDto>>> {
  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }
  const parsed = coverUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  try {
    return NextResponse.json({ ok: true, data: await updateCover(id, parsed.data) });
  } catch (err) {
    return apiError(`PATCH /api/projects/${id}/cover`, err);
  }
}
