import { del, list, put } from "@vercel/blob";
import type { ImageStorage, StoredFileInfo } from "./types";

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

  async delete(url: string): Promise<void> {
    await del(url);
  }

  async list(prefix: string): Promise<StoredFileInfo[]> {
    const out: StoredFileInfo[] = [];
    let cursor: string | undefined;
    do {
      const page = await list({ prefix, cursor, limit: 1000 });
      for (const b of page.blobs) {
        out.push({ key: b.pathname, url: b.url, sizeBytes: b.size });
      }
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return out;
  }
}
