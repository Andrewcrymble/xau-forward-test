import { NextRequest, NextResponse } from "next/server";
import {
  cleanupStorage,
  migrateStorage,
  recompressImages,
  storageUsage,
  type CleanupResult,
  type MigrateResult,
  type RecompressResult,
} from "@/lib/services/maintenance-service";
import { apiError } from "@/lib/api-helpers";
import type { ApiResponse } from "@/lib/types";

// Storage maintenance walks and rewrites many blobs.
export const maxDuration = 300;

export async function GET(): Promise<
  NextResponse<
    ApiResponse<{
      backend: string;
      totalFiles: number;
      totalBytes: number;
      foreignFiles: number;
    }>
  >
> {
  try {
    return NextResponse.json({ ok: true, data: await storageUsage() });
  } catch (err) {
    return apiError("GET /api/maintenance/storage", err);
  }
}

/** Free up storage (default), recompress existing images
 *  ({"action":"recompress"}), or migrate files onto the active backend
 *  ({"action":"migrate"}). */
export async function POST(
  req: NextRequest,
): Promise<NextResponse<ApiResponse<CleanupResult | RecompressResult | MigrateResult>>> {
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
    if (action === "migrate") {
      return NextResponse.json({ ok: true, data: await migrateStorage() });
    }
    return NextResponse.json({ ok: true, data: await cleanupStorage() });
  } catch (err) {
    return apiError("POST /api/maintenance/storage", err);
  }
}
