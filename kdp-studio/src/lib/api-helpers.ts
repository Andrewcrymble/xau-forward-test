import { NextResponse } from "next/server";
import { PageServiceError } from "@/lib/services/page-service";
import type { ApiResponse } from "@/lib/types";

/** Uniform error handling for API routes. */
export function apiError(
  route: string,
  err: unknown,
): NextResponse<ApiResponse<never>> {
  if (err instanceof PageServiceError) {
    return NextResponse.json(
      { ok: false as const, error: err.message },
      { status: err.status },
    );
  }
  console.error(`${route} failed:`, err);
  const message =
    err instanceof Error && err.message.startsWith("OpenAI")
      ? err.message // provider errors are safe + useful to surface
      : "Something went wrong. Please try again.";
  return NextResponse.json(
    { ok: false as const, error: message },
    { status: 500 },
  );
}
