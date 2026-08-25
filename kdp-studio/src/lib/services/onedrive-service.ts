// Automatic OneDrive delivery of finished packages via Microsoft Graph.
//
// Auth is app-only (client credentials): an Azure app registration with the
// APPLICATION permission Files.ReadWrite.All + admin consent. No sign-in
// flow, no refresh tokens — just three values in the environment. Uploads
// use Graph upload sessions (chunked), so large ZIPs work fine.
//
// Failure here must NEVER break a package build — callers get a status
// object and show it; the download link always still works.

interface OneDriveConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  /** UPN of the OneDrive owner, e.g. andrew@example.com */
  user: string;
  /** Folder path under the drive root, e.g. "Business/ColourJoy". */
  basePath: string;
}

export interface OneDriveUploadResult {
  status: "uploaded" | "error" | "not_configured";
  /** Human-readable OneDrive path of the uploaded file. */
  path?: string;
  webUrl?: string;
  error?: string;
}

const GRAPH = "https://graph.microsoft.com/v1.0";
/** Chunk size must be a multiple of 320 KiB; 8 MiB keeps request counts low. */
const CHUNK = 320 * 1024 * 25;

export function oneDriveConfig(): OneDriveConfig | null {
  const tenantId = process.env.MS_TENANT_ID;
  const clientId = process.env.MS_CLIENT_ID;
  const clientSecret = process.env.MS_CLIENT_SECRET;
  const user = process.env.ONEDRIVE_USER;
  if (!tenantId || !clientId || !clientSecret || !user) return null;
  return {
    tenantId,
    clientId,
    clientSecret,
    user,
    basePath: (process.env.ONEDRIVE_BASE_PATH || "Business/ColourJoy")
      .replace(/^\/+|\/+$/g, ""),
  };
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function graphToken(cfg: OneDriveConfig): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }
  const res = await fetch(
    `https://login.microsoftonline.com/${cfg.tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
      }),
    },
  );
  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new Error(
      `Microsoft sign-in failed (${res.status}): ${
        (json.error_description ?? "").split("\n")[0].slice(0, 200) ||
        "check MS_TENANT_ID / MS_CLIENT_ID / MS_CLIENT_SECRET"
      }`,
    );
  }
  cachedToken = {
    token: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
  return json.access_token;
}

/** OneDrive-safe folder name from a book/project name. */
function cleanSegment(name: string): string {
  return (
    name
      .replace(/[\\/:*?"<>|#%]/g, "-")
      .replace(/\s+/g, " ")
      .replace(/\.+$/, "")
      .trim()
      .slice(0, 100) || "book"
  );
}

function drivePath(cfg: OneDriveConfig, segments: string[]): string {
  return `${GRAPH}/users/${encodeURIComponent(cfg.user)}/drive/root:/${segments
    .map(encodeURIComponent)
    .join("/")}`;
}

/** Create each folder level if missing (409 name-exists is fine). */
async function ensureFolders(
  cfg: OneDriveConfig,
  token: string,
  segments: string[],
): Promise<void> {
  const parents: string[] = [];
  for (const segment of segments) {
    const url =
      parents.length === 0
        ? `${GRAPH}/users/${encodeURIComponent(cfg.user)}/drive/root/children`
        : `${drivePath(cfg, parents)}:/children`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: segment,
        folder: {},
        "@microsoft.graph.conflictBehavior": "fail",
      }),
    });
    if (!res.ok && res.status !== 409) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `Could not create OneDrive folder "${segment}" (${res.status}): ${text.slice(0, 200)}`,
      );
    }
    parents.push(segment);
  }
}

/**
 * Upload one finished package into OneDrive under
 * {basePath}/{book name}/{filename}, replacing any previous copy.
 */
export async function uploadToOneDrive(
  bookName: string,
  filename: string,
  bytes: Buffer,
): Promise<OneDriveUploadResult> {
  const cfg = oneDriveConfig();
  if (!cfg) return { status: "not_configured" };
  try {
    const token = await graphToken(cfg);
    const segments = [...cfg.basePath.split("/").filter(Boolean), cleanSegment(bookName)];
    await ensureFolders(cfg, token, segments);

    const sessionRes = await fetch(
      `${drivePath(cfg, [...segments, filename])}:/createUploadSession`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          item: { "@microsoft.graph.conflictBehavior": "replace" },
        }),
      },
    );
    const session = (await sessionRes.json().catch(() => ({}))) as {
      uploadUrl?: string;
      error?: { message?: string };
    };
    if (!sessionRes.ok || !session.uploadUrl) {
      throw new Error(
        `Could not start the OneDrive upload (${sessionRes.status}): ${
          session.error?.message?.slice(0, 200) ?? "no upload session"
        }`,
      );
    }

    let item: { webUrl?: string } = {};
    for (let start = 0; start < bytes.length; start += CHUNK) {
      const end = Math.min(start + CHUNK, bytes.length);
      const chunk = bytes.subarray(start, end);
      const putRes = await fetch(session.uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Length": String(chunk.length),
          "Content-Range": `bytes ${start}-${end - 1}/${bytes.length}`,
        },
        body: new Uint8Array(chunk),
      });
      if (!putRes.ok) {
        const text = await putRes.text().catch(() => "");
        throw new Error(
          `OneDrive upload failed at ${Math.round((start / bytes.length) * 100)}% (${putRes.status}): ${text.slice(0, 200)}`,
        );
      }
      if (putRes.status === 200 || putRes.status === 201) {
        item = (await putRes.json().catch(() => ({}))) as { webUrl?: string };
      }
    }

    return {
      status: "uploaded",
      path: `${segments.join("/")}/${filename}`,
      webUrl: item.webUrl,
    };
  } catch (err) {
    return {
      status: "error",
      error: err instanceof Error ? err.message : "OneDrive upload failed",
    };
  }
}
