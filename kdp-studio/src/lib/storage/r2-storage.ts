import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { ImageStorage, StoredFileInfo } from "./types";

// Cloudflare R2 storage (S3-compatible). Free tier is 10GB with no egress
// fees — ten times Vercel Blob's free allowance. Needs five env vars:
//
//   R2_ACCOUNT_ID        Cloudflare account id (dashboard → R2 → API)
//   R2_ACCESS_KEY_ID     R2 API token access key
//   R2_SECRET_ACCESS_KEY R2 API token secret
//   R2_BUCKET            bucket name, e.g. kdp-artwork
//   R2_PUBLIC_BASE_URL   the bucket's public URL, e.g. https://pub-xxxx.r2.dev
//                        (enable "Public Development URL" on the bucket)
//
// Files are written via the S3 API and served from the public bucket URL.
// readBytes/delete also accept URLs from other backends (e.g. files still
// sitting in Vercel Blob after a switch): foreign URLs are fetched over
// HTTP and never deleted here — the migration action moves them across.

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl: string;
}

export function r2ConfigFromEnv(): R2Config | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL?.replace(/\/+$/, "");
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicBaseUrl) {
    return null;
  }
  return { accountId, accessKeyId, secretAccessKey, bucket, publicBaseUrl };
}

export class R2ImageStorage implements ImageStorage {
  readonly name = "cloudflare-r2";
  private client: S3Client;
  private bucket: string;
  private publicBaseUrl: string;

  constructor(config: R2Config) {
    this.bucket = config.bucket;
    this.publicBaseUrl = config.publicBaseUrl;
    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  /** The bucket key for one of our public URLs, or null for foreign URLs. */
  private keyOf(url: string): string | null {
    if (!url.startsWith(this.publicBaseUrl + "/")) return null;
    return decodeURIComponent(url.slice(this.publicBaseUrl.length + 1));
  }

  ownsUrl(url: string): boolean {
    return url.startsWith(this.publicBaseUrl + "/");
  }

  async put(key: string, data: Buffer, contentType: string): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: data,
        ContentType: contentType,
      }),
    );
    return `${this.publicBaseUrl}/${key}`;
  }

  async readBytes(url: string): Promise<Buffer> {
    const key = this.keyOf(url);
    if (key) {
      const res = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      const bytes = await res.Body?.transformToByteArray();
      if (!bytes) throw new Error(`Empty object for ${key}`);
      return Buffer.from(bytes);
    }
    // Foreign URL (e.g. a file still in Vercel Blob) — plain fetch.
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch stored file (${res.status})`);
    return Buffer.from(await res.arrayBuffer());
  }

  async delete(url: string): Promise<void> {
    const key = this.keyOf(url);
    if (!key) return; // never delete files belonging to another backend
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch {
      // Missing objects are fine.
    }
  }

  async list(prefix: string): Promise<StoredFileInfo[]> {
    const out: StoredFileInfo[] = [];
    let token: string | undefined;
    do {
      const page = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ContinuationToken: token,
        }),
      );
      for (const obj of page.Contents ?? []) {
        if (!obj.Key) continue;
        out.push({
          key: obj.Key,
          url: `${this.publicBaseUrl}/${obj.Key}`,
          sizeBytes: obj.Size ?? 0,
        });
      }
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
    return out;
  }
}
