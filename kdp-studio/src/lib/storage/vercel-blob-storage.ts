import { put } from "@vercel/blob";
import type { ImageStorage } from "./types";

// Vercel Blob storage for hosted deployments. Requires
// BLOB_READ_WRITE_TOKEN (created automatically when a Blob store is
// connected to the Vercel project). Files get public CDN URLs.

export class VercelBlobStorage implements ImageStorage {
  readonly name = "vercel-blob";

  async put(key: string, data: Buffer, contentType: string): Promise<string> {
    const blob = await put(key, data, {
      access: "public",
      contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return blob.url;
  }

  async readBytes(url: string): Promise<Buffer> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch stored file (${res.status})`);
    return Buffer.from(await res.arrayBuffer());
  }
}
