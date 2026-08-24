import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { buildBookConcept, updateBookConcept } from "@/lib/services/concept-service";
import { apiError } from "@/lib/api-helpers";
import type { ApiResponse, BookConcept } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

/** Build (or rebuild) the book concept + style profile. */
export async function POST(
  _req: NextRequest,
  ctx: Ctx,
): Promise<NextResponse<ApiResponse<BookConcept>>> {
  const { id } = await ctx.params;
  try {
    return NextResponse.json({ ok: true, data: await buildBookConcept(id) });
  } catch (err) {
    return apiError(`POST /api/projects/${id}/concept`, err);
  }
}

const conceptUpdateSchema = z
  .object({
    creativeBrief: z.string().trim().min(1).max(8000),
    styleProfile: z
      .object({
        lineThickness: z.string().trim().max(300),
        decorativeStyle: z.string().trim().max(300),
        characterStyle: z.string().trim().max(300),
        botanicalStyle: z.string().trim().max(300),
        landscapeStyle: z.string().trim().max(300),
        architecturalStyle: z.string().trim().max(300),
        framingStyle: z.string().trim().max(300),
        whiteSpace: z.string().trim().max(300),
        overallAesthetic: z.string().trim().max(300),
        recurringMotifs: z.array(z.string().trim().max(120)).max(20),
        levelOfDetail: z.string().trim().max(300),
      })
      .partial(),
  })
  .partial();

export async function PATCH(
  req: NextRequest,
  ctx: Ctx,
): Promise<NextResponse<ApiResponse<BookConcept>>> {
  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = conceptUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  try {
    return NextResponse.json({
      ok: true,
      data: await updateBookConcept(id, parsed.data),
    });
  } catch (err) {
    return apiError(`PATCH /api/projects/${id}/concept`, err);
  }
}
