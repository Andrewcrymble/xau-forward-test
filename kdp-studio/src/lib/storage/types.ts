// Image/file storage abstraction. The app never touches a storage backend
// directly — always through this interface, so local disk (development),
// Vercel Blob (hosted), or S3/R2/Supabase (later) are configuration
// choices, not rewrites.
//
// A stored file is referenced everywhere (database included) by the URL
// returned from put(): local storage returns an app-served path
// (/api/files/...), hosted backends return their public URL. readBytes()
// accepts that same reference so later phases (PDF building) can load the
// file body regardless of backend.

export interface StoredFileInfo {
  key: string;
  url: string;
  sizeBytes: number;
}

export interface ImageStorage {
  readonly name: string;
  /** Store a file under a hierarchical key; returns the servable URL. */
  put(key: string, data: Buffer, contentType: string): Promise<string>;
  /** Load a stored file's bytes from the URL returned by put(). */
  readBytes(url: string): Promise<Buffer>;
  /** Delete a stored file by its URL. Missing files are not an error. */
  delete(url: string): Promise<void>;
  /** List stored files under a key prefix (used by storage cleanup). */
  list(prefix: string): Promise<StoredFileInfo[]>;
  /** Whether a stored URL belongs to this backend (used by migration). */
  ownsUrl(url: string): boolean;
}
