import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { buildBookFromNiche, type BuildBookResult } from "@/lib/services/niche-service";
import { apiError } from "@/lib/api-helpers";
import type { ApiResponse } from "@/lib/types";

type Ctx = { params: Promise<{ nicheId: string }> };

const bodySchema = z.object({ force: z.boolean().default(false) });

export async function POST(
  req: NextRequest,
  ctx: Ctx,
): Promise<NextResponse<ApiResponse<BuildBookResult>>> {
  const { nicheId } = await ctx.params;
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    // Empty body means default options.
  }
  const parsed = bodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  try {
    return NextResponse.json({
      ok: true,
      data: await buildBookFromNiche(nicheId, parsed.data),
    });
  } catch (err) {
    return apiError(`POST /api/niches/${nicheId}/build`, err);
  }
}
