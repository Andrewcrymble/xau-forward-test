import { NextRequest, NextResponse } from "next/server";
import {
  computeInteriorLayout,
  type InteriorLayout,
} from "@/lib/services/interior-service";
import { apiError } from "@/lib/api-helpers";
import type { ApiResponse } from "@/lib/types";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse<ApiResponse<InteriorLayout>>> {
  const { id } = await ctx.params;
  try {
    const layout = await computeInteriorLayout(id);
    return NextResponse.json({ ok: true, data: layout });
  } catch (err) {
    return apiError(`GET /api/projects/${id}/interior/layout`, err);
  }
}
