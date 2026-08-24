import { NextResponse } from "next/server";
import {
  cleanupStorage,
  storageUsage,
  type CleanupResult,
} from "@/lib/services/maintenance-service";
import { apiError } from "@/lib/api-helpers";
import type { ApiResponse } from "@/lib/types";

// Storage cleanup can walk and delete many blobs.
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

/** Free up storage: prune superseded exports + delete orphaned files. */
export async function POST(): Promise<NextResponse<ApiResponse<CleanupResult>>> {
  try {
    return NextResponse.json({ ok: true, data: await cleanupStorage() });
  } catch (err) {
    return apiError("POST /api/maintenance/storage", err);
  }
}
