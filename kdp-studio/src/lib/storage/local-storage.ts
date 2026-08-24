import { mkdir, readFile, readdir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ImageStorage, StoredFileInfo } from "./types";

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

  ownsUrl(url: string): boolean {
    return url.startsWith(URL_PREFIX);
  }

  async delete(url: string): Promise<void> {
    if (!url.startsWith(URL_PREFIX)) return;
    try {
      await unlink(resolveLocalKey(url.slice(URL_PREFIX.length)));
    } catch {
      // Missing files are fine.
    }
  }

  async list(prefix: string): Promise<StoredFileInfo[]> {
    const out: StoredFileInfo[] = [];
    const walk = async (dir: string) => {
      let entries;
      try {
        entries = await readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) await walk(full);
        else {
          const key = path.relative(LOCAL_STORAGE_ROOT, full).split(path.sep).join("/");
          if (!key.startsWith(prefix)) continue;
          const s = await stat(full);
          out.push({ key, url: URL_PREFIX + key, sizeBytes: s.size });
        }
      }
    };
    await walk(LOCAL_STORAGE_ROOT);
    return out;
  }
}
