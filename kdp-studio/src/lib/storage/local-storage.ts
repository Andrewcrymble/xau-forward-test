import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ImageStorage } from "./types";

// Local-disk storage for development. Files live under <app>/storage and
// are served by the /api/files/[...key] route. Not suitable for serverless
// hosting (ephemeral disk) — the hosted app uses Vercel Blob instead.

export const LOCAL_STORAGE_ROOT = path.join(process.cwd(), "storage");
const URL_PREFIX = "/api/files/";

export function resolveLocalKey(key: string): string {
  // Prevent path traversal — resolved paths must stay inside the root.
  const resolved = path.resolve(LOCAL_STORAGE_ROOT, key);
  if (!resolved.startsWith(LOCAL_STORAGE_ROOT + path.sep)) {
    throw new Error("Invalid storage key");
  }
  return resolved;
}

export class LocalImageStorage implements ImageStorage {
  readonly name = "local";

  async put(key: string, data: Buffer): Promise<string> {
    const filePath = resolveLocalKey(key);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, data);
    return URL_PREFIX + key;
  }

  async readBytes(url: string): Promise<Buffer> {
    if (!url.startsWith(URL_PREFIX)) {
      throw new Error(`Not a local storage URL: ${url}`);
    }
    return readFile(resolveLocalKey(url.slice(URL_PREFIX.length)));
  }
}
