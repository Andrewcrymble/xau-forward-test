import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  deleteNicheIdea,
  saveNicheAmazonResearch,
  updateNicheStatus,
} from "@/lib/services/niche-service";
import { apiError } from "@/lib/api-helpers";
import { NICHE_STATUSES, type ApiResponse, type NicheIdeaDto } from "@/lib/types";

type Ctx = { params: Promise<{ nicheId: string }> };

const amazonResearchSchema = z.object({
  market: z.enum(["amazon_com", "amazon_co_uk"]),
  entries: z
    .array(
      z.object({
        bsr: z.number().int().min(1).max(50_000_000),
        price: z.number().min(0).max(1000).nullable(),
      }),
    )
    .min(1)
    .max(8),
  note: z.string().trim().max(300).nullish(),
});

const bodySchema = z
  .object({
    status: z.enum(NICHE_STATUSES),
    amazonResearch: amazonResearchSchema.nullable(),
  })
  .partial()
  .refine((b) => b.status !== undefined || b.amazonResearch !== undefined, {
    message: "Provide status or amazonResearch",
  });

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
    let updated: NicheIdeaDto | null = null;
    if (parsed.data.amazonResearch !== undefined) {
      updated = await saveNicheAmazonResearch(nicheId, parsed.data.amazonResearch);
    }
    if (parsed.data.status !== undefined) {
      updated = await updateNicheStatus(nicheId, parsed.data.status);
    }
    return NextResponse.json({ ok: true, data: updated! });
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
