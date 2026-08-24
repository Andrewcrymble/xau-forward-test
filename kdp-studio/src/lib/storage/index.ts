import "server-only";
import type { ImageStorage } from "./types";
import { LocalImageStorage } from "./local-storage";
import { VercelBlobStorage } from "./vercel-blob-storage";
import { R2ImageStorage, r2ConfigFromEnv } from "./r2-storage";

// STORAGE_PROVIDER=local|vercel-blob|r2 forces a backend. When unset:
// Cloudflare R2 if its env vars are configured, else Vercel Blob if its
// token is configured (the hosted default), else local disk (development).

export function getImageStorage(): ImageStorage {
  const requested = process.env.STORAGE_PROVIDER?.toLowerCase();
  const r2Config = r2ConfigFromEnv();
  const hasBlobToken = !!process.env.BLOB_READ_WRITE_TOKEN;

  if (requested === "local") return new LocalImageStorage();
  if (requested === "r2") {
    if (!r2Config) {
      throw new Error(
        "STORAGE_PROVIDER=r2 but R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET / R2_PUBLIC_BASE_URL are not all set",
      );
    }
    return new R2ImageStorage(r2Config);
  }
  if (requested === "vercel-blob") {
    if (!hasBlobToken) {
      throw new Error(
        "STORAGE_PROVIDER=vercel-blob but BLOB_READ_WRITE_TOKEN is not set",
      );
    }
    return new VercelBlobStorage();
  }
  if (r2Config) return new R2ImageStorage(r2Config);
  return hasBlobToken ? new VercelBlobStorage() : new LocalImageStorage();
}
