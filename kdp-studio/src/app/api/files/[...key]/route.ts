import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { resolveLocalKey } from "@/lib/storage/local-storage";

// Serves files written by the local storage provider (development only —
// hosted deployments use Vercel Blob's public CDN URLs instead).

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ key: string[] }> },
): Promise<NextResponse> {
  const { key } = await ctx.params;
  try {
    const filePath = resolveLocalKey(key.join("/"));
    const data = await readFile(filePath);
    const type = filePath.endsWith(".png")
      ? "image/png"
      : filePath.endsWith(".pdf")
        ? "application/pdf"
        : "application/octet-stream";
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": type,
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
