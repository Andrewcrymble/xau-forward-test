"use client";

/* eslint-disable @next/next/no-img-element */

// Per-page reference photo upload: the user attaches a real photo (e.g. a
// mural) and generation redraws THAT image as the colouring page. Photos
// are downscaled in the browser before upload so big camera files stay
// under hosted request-size limits.

import { useRef, useState } from "react";
import type { ApiResponse, PageDto } from "@/lib/types";
import { Button } from "@/components/ui";

async function downscaleToJpeg(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 3_500_000 && file.type === "image/jpeg") {
      return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85),
    );
    return blob ?? file;
  } catch {
    // HEIC or anything the browser can't decode — let the server try.
    return file;
  }
}

export function ReferencePhotoControl({
  page,
  onPageUpdate,
  compact = false,
}: {
  page: PageDto;
  onPageUpdate: (page: PageDto) => void;
  compact?: boolean;
}) {
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const blob = await downscaleToJpeg(file);
      const form = new FormData();
      form.append("file", blob, "reference.jpg");
      const res = await fetch(`/api/pages/${page.id}/reference`, {
        method: "POST",
        body: form,
      });
      const json: ApiResponse<PageDto> = await res.json();
      if (!json.ok) throw new Error(json.error);
      onPageUpdate(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/pages/${page.id}/reference`, { method: "DELETE" });
      const json: ApiResponse<PageDto> = await res.json();
      if (!json.ok) throw new Error(json.error);
      onPageUpdate(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remove failed");
    } finally {
      setBusy(false);
    }
  };

  const input = (
    <input
      ref={fileInput}
      type="file"
      accept="image/*"
      className="hidden"
      onChange={(e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (file) void upload(file);
      }}
    />
  );

  if (compact) {
    return (
      <>
        {input}
        <button
          type="button"
          disabled={busy}
          onClick={() => fileInput.current?.click()}
          className={`rounded-md border px-2 py-1 text-xs ${
            page.referenceImage
              ? "border-violet-300 bg-violet-50 text-violet-700"
              : "border-stone-300 bg-white text-stone-600 hover:bg-stone-100"
          }`}
          title={
            page.referenceImage
              ? "Reference photo attached — generation redraws it. Tap to replace."
              : "Attach a reference photo for the AI to redraw"
          }
        >
          {busy ? "Uploading…" : page.referenceImage ? "📷 Ref ✓" : "📷 Add ref"}
        </button>
      </>
    );
  }

  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2">
      {input}
      <p className="text-xs font-semibold text-violet-800">Reference photo</p>
      <p className="mt-0.5 text-[11px] text-violet-700">
        Attach a real photo (a mural, a building, a scene) and generation
        redraws that exact image as the colouring page instead of inventing
        one.
      </p>
      {page.referenceImage && (
        <img
          src={page.referenceImage}
          alt="Reference"
          className="mt-2 max-h-32 w-auto rounded-md border border-violet-200"
        />
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => fileInput.current?.click()}
        >
          {busy
            ? "Uploading…"
            : page.referenceImage
              ? "Replace photo"
              : "Upload photo"}
        </Button>
        {page.referenceImage && (
          <Button variant="danger" disabled={busy} onClick={remove}>
            Remove
          </Button>
        )}
      </div>
      {page.referenceImage && (
        <p className="mt-1.5 text-[11px] text-violet-700">
          Tap Regenerate to redraw the page from this photo.
        </p>
      )}
      {error && (
        <p className="mt-1.5 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[11px] text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
