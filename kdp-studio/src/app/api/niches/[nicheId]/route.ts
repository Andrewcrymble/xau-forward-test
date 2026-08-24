import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { deleteNicheIdea, updateNicheStatus } from "@/lib/services/niche-service";
import { apiError } from "@/lib/api-helpers";
import { NICHE_STATUSES, type ApiResponse, type NicheIdeaDto } from "@/lib/types";

type Ctx = { params: Promise<{ nicheId: string }> };

const bodySchema = z.object({ status: z.enum(NICHE_STATUSES) });

export async function PATCH(
  req: NextRequest,
  ctx: Ctx,
): Promise<NextResponse<ApiResponse<NicheIdeaDto>>> {
  const { nicheId } = await ctx.params;
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
      data: await updateNicheStatus(nicheId, parsed.data.status),
    });
  } catch (err) {
    return apiError(`PATCH /api/niches/${nicheId}`, err);
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: Ctx,
): Promise<NextResponse<ApiResponse<{ deleted: true }>>> {
  const { nicheId } = await ctx.params;
  try {
    await deleteNicheIdea(nicheId);
    return NextResponse.json({ ok: true, data: { deleted: true } });
  } catch (err) {
    return apiError(`DELETE /api/niches/${nicheId}`, err);
  }
}
