import { NextRequest, NextResponse } from "next/server";
import { getListing, updateListing } from "@/lib/services/listing-service";
import { listingUpdateSchema } from "@/lib/validation/listing";
import { apiError } from "@/lib/api-helpers";
import type { ApiResponse, ListingContent } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(
  _req: NextRequest,
  ctx: Ctx,
): Promise<NextResponse<ApiResponse<ListingContent | null>>> {
  const { id } = await ctx.params;
  try {
    return NextResponse.json({ ok: true, data: await getListing(id) });
  } catch (err) {
    return apiError(`GET /api/projects/${id}/listing`, err);
  }
}

export async function PATCH(
  req: NextRequest,
  ctx: Ctx,
): Promise<NextResponse<ApiResponse<ListingContent>>> {
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
  const parsed = listingUpdateSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { ok: false, error: first?.message ?? "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  try {
    return NextResponse.json({ ok: true, data: await updateListing(id, parsed.data) });
  } catch (err) {
    return apiError(`PATCH /api/projects/${id}/listing`, err);
  }
}
