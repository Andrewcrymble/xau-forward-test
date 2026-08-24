import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { discoverNiches } from "@/lib/services/niche-service";
import { apiError } from "@/lib/api-helpers";
import type { ApiResponse, NicheIdeaDto } from "@/lib/types";

export const maxDuration = 120;

const bodySchema = z.object({
  broadTopic: z.string().trim().max(300),
  market: z.string().trim().max(100).nullish(),
  audience: z.string().trim().max(200).nullish(),
  bookType: z.string().trim().max(100).nullish(),
  count: z.number().int().min(3).max(30),
  parentId: z.string().nullish(),
  combineWith: z.string().trim().max(300).nullish(),
});

export async function POST(
  req: NextRequest,
): Promise<NextResponse<ApiResponse<NicheIdeaDto[]>>> {
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
    return NextResponse.json({ ok: true, data: await discoverNiches(parsed.data) });
  } catch (err) {
    return apiError("POST /api/niches/discover", err);
  }
}
