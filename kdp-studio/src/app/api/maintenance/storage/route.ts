import { NextRequest, NextResponse } from "next/server";
import {
  cleanupStorage,
  recompressImages,
  storageUsage,
  type CleanupResult,
  type RecompressResult,
} from "@/lib/services/maintenance-service";
import { apiError } from "@/lib/api-helpers";
import type { ApiResponse } from "@/lib/types";

// Storage maintenance walks and rewrites many blobs.
export const maxDuration = 300;

export async function GET(): Promise<
  NextResponse<ApiResponse<{ totalFiles: number; totalBytes: number }>>
> {
  try {
    return NextResponse.json({ ok: true, data: await storageUsage() });
  } catch (err) {
    return apiError("GET /api/maintenance/storage", err);
  }
}

/** Free up storage (default) or recompress existing images
 *  (body: {"action":"recompress"}). */
export async function POST(
  req: NextRequest,
): Promise<NextResponse<ApiResponse<CleanupResult | RecompressResult>>> {
  let action = "cleanup";
  try {
    const body = (await req.json()) as { action?: string };
    if (body?.action) action = body.action;
  } catch {
    // Empty body = default cleanup.
  }
  try {
    if (action === "recompress") {
      return NextResponse.json({ ok: true, data: await recompressImages() });
    }
    return NextResponse.json({ ok: true, data: await cleanupStorage() });
  } catch (err) {
    return apiError("POST /api/maintenance/storage", err);
  }
}
