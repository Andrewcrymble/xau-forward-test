import "server-only";
import type { ImageStorage } from "./types";
import { LocalImageStorage } from "./local-storage";
import { VercelBlobStorage } from "./vercel-blob-storage";

// STORAGE_PROVIDER=local|vercel-blob; when unset, Vercel Blob is used if
// its token is configured (i.e. on the hosted app), local disk otherwise.

export function getImageStorage(): ImageStorage {
  const requested = process.env.STORAGE_PROVIDER?.toLowerCase();
  const hasBlobToken = !!process.env.BLOB_READ_WRITE_TOKEN;

  if (requested === "local") return new LocalImageStorage();
  if (requested === "vercel-blob") {
    if (!hasBlobToken) {
      throw new Error(
        "STORAGE_PROVIDER=vercel-blob but BLOB_READ_WRITE_TOKEN is not set",
      );
    }
    return new VercelBlobStorage();
  }
  return hasBlobToken ? new VercelBlobStorage() : new LocalImageStorage();
}
