"use client";

// Export tab: readiness checklist for the whole book, then the one-button
// complete KDP package download. Only approved images ever reach exports.

import { useState } from "react";
import Link from "next/link";
import type { ApiResponse, ProjectDto } from "@/lib/types";
import type {
  ExportReadiness,
  PackageBuildResult,
} from "@/lib/services/export-service";
import type { QualityReport } from "@/lib/services/quality-service";
import { Button, Card } from "@/components/ui";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const json: ApiResponse<T> = await res.json();
  if (!json.ok) throw new Error(json.error);
  return json.data;
}

function CheckRow({
  ok,
  label,
  detail,
  href,
  linkText,
}: {
  ok: boolean;
  label: string;
  detail: string;
  href?: string;
  linkText?: string;
}) {
  return (
    <li className="flex items-start gap-3 py-2">
      <span
        className={`mt-0.5 inline-flex h-5 w-5 flex-none items-center justify-center rounded-full text-xs font-bold ${
          ok ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
        }`}
      >
        {ok ? "✓" : "!"}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-stone-800">{label}</span>
        <span className="block text-xs text-stone-500">
          {detail}
          {!ok && href && linkText && (
            <>
              {" — "}
              <Link href={href} className="font-semibold text-stone-700 underline">
                {linkText}
              </Link>
            </>
          )}
        </span>
      </span>
    </li>
  );
}

export function ExportScreen({
  project,
  readiness,
}: {
  project: ProjectDto;
  readiness: ExportReadiness;
}) {
  const [building, setBuilding] = useState(false);
  const [result, setResult] = useState<PackageBuildResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const build = async () => {
    setBuilding(true);
    setError(null);
    try {
      setResult(
        await api<PackageBuildResult>(`/api/projects/${project.id}/export/package`, {
          method: "POST",
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Package build failed");
    } finally {
      setBuilding(false);
    }
  };

  const [quality, setQuality] = useState<QualityReport | null>(null);
  const [checking, setChecking] = useState(false);

  const runQualityCheck = async () => {
    setChecking(true);
    setError(null);
    try {
      setQuality(
        await api<QualityReport>(`/api/projects/${project.id}/quality`, {
          method: "POST",
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Quality check failed");
    } finally {
      setChecking(false);
    }
  };

  const [etsyBuilding, setEtsyBuilding] = useState(false);
  const [etsyResult, setEtsyResult] = useState<PackageBuildResult | null>(null);

  const buildEtsy = async () => {
    setEtsyBuilding(true);
    setError(null);
    try {
      setEtsyResult(
        await api<PackageBuildResult>(`/api/projects/${project.id}/export/etsy`, {
          method: "POST",
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Etsy pack build failed");
    } finally {
      setEtsyBuilding(false);
    }
  };

  const r = readiness;
  const base = `/projects/${project.id}`;
  const download = result?.url ?? r.latestPackage?.url ?? null;
  const etsyDownload = etsyResult?.url ?? r.latestEtsyPack?.url ?? null;

  const oneDriveNote = (od: PackageBuildResult["oneDrive"] | undefined) => {
    if (!od) return null;
    if (od.status === "uploaded") {
      return (
        <p className="text-xs text-emerald-700">
          ✓ Saved to OneDrive: {od.path}
        </p>
      );
    }
    if (od.status === "error") {
      return (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          OneDrive save failed: {od.error} — the download link above still
          works.
        </p>
      );
    }
    return (
      <p className="text-xs text-stone-400">
        Auto-save to OneDrive is off — add the OneDrive secrets (see the
        DEPLOY guide) to file every package automatically.
      </p>
    );
  };

  return (
    <div className="space-y-5">
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-stone-900">
              Book quality check
            </h2>
            <p className="text-xs text-stone-500">
              Whole-book review: duplicate or too-similar concepts, duplicate
              verses, failed image checks, colour-by-numbers findings,
              repetitive motifs and workflow gaps.
            </p>
          </div>
          <Button onClick={runQualityCheck} disabled={checking}>
            {checking ? "Checking…" : quality ? "Re-run quality check" : "Run quality check"}
          </Button>
        </div>
        {quality && (
          <div className="space-y-2">
            <p
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                quality.ready
                  ? "bg-emerald-50 text-emerald-800"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {quality.ready
                ? `READY FOR BOOK ASSEMBLY — ${quality.approvedPages}/${quality.totalPages} pages approved${quality.issues.length > 0 ? `, ${quality.issues.length} advisory note(s) below` : ""}`
                : "ISSUES FOUND — fix the errors below before assembling the book"}
            </p>
            <ul className="space-y-1.5">
              {quality.issues.map((issue, i) => (
                <li
                  key={i}
                  className={`rounded-lg border px-3 py-2 text-xs ${
                    issue.severity === "error"
                      ? "border-red-200 bg-red-50 text-red-700"
                      : "border-amber-200 bg-amber-50 text-amber-800"
                  }`}
                >
                  <span className="font-semibold uppercase">{issue.severity}</span>{" "}
                  {issue.message}
                  {issue.pageNumbers.length > 0 && (
                    <span className="block text-[11px] opacity-80">
                      Pages: {issue.pageNumbers.join(", ")}
                    </span>
                  )}
                </li>
              ))}
              {quality.issues.length === 0 && (
                <li className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                  No issues found.
                </li>
              )}
            </ul>
          </div>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="mb-2 text-base font-semibold text-stone-900">
            Ready to publish?
          </h2>
          <ul className="divide-y divide-stone-100">
            <CheckRow
              ok={r.approvedPages > 0 && r.approvedPages >= r.totalPages}
              label={`${r.approvedPages} of ${r.totalPages} pages approved`}
              detail={
                r.approvedPages >= r.totalPages && r.totalPages > 0
                  ? "Every page is approved"
                  : "Only approved pages are included in the package"
              }
              href={`${base}/images`}
              linkText="review pages"
            />
            <CheckRow
              ok={r.interiorBuilt}
              label="Interior PDF"
              detail={
                r.interiorBuilt
                  ? "The latest build will be packaged — rebuild first if you've changed pages"
                  : "Not built yet (it will be built automatically during export)"
              }
              href={`${base}/interior`}
              linkText="build interior"
            />
            <CheckRow
              ok={r.coverBuilt}
              label="Cover PDF"
              detail={
                r.coverBuilt
                  ? "The latest build will be packaged — rebuild first if you've changed the cover"
                  : "Not built yet (it will be built automatically during export)"
              }
              href={`${base}/cover`}
              linkText="build cover"
            />
            <CheckRow
              ok={r.listingReady}
              label="Amazon listing"
              detail={
                r.listingReady
                  ? "amazon-listing.txt will be included"
                  : "Optional — generate it to include amazon-listing.txt"
              }
              href={`${base}/listing`}
              linkText="generate listing"
            />
          </ul>
        </Card>

        <Card className="space-y-3">
          <h2 className="text-base font-semibold text-stone-900">
            Complete KDP package
          </h2>
          <p className="text-sm text-stone-600">
            One ZIP with everything Amazon needs: the print-ready interior and
            wraparound cover PDFs, every approved page as numbered PNGs, your
            listing text, and a project summary.
          </p>
          <pre className="overflow-x-auto rounded-lg bg-stone-50 p-3 text-xs leading-relaxed text-stone-600">{`${project.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")}.zip
├── interior/book-interior.pdf
├── cover/book-cover.pdf
├── images/001.png … ${String(Math.max(r.approvedPages, 1)).padStart(3, "0")}.png
├── listing/amazon-listing.txt
└── project-details.json`}</pre>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={build} disabled={building || r.approvedPages === 0}>
              {building ? "Packaging…" : "Download Complete KDP Package"}
            </Button>
            {download && (
              <a
                href={download}
                className="text-sm font-semibold text-stone-900 underline underline-offset-2"
              >
                Download {result ? "package" : "latest package"}
              </a>
            )}
          </div>
          {result && (
            <p className="text-xs text-emerald-700">
              Packaged {result.imageCount} approved pages ·{" "}
              {(result.bytes / 1024 / 1024).toFixed(1)} MB — tap Download above.
            </p>
          )}
          {oneDriveNote(result?.oneDrive)}
          {!result && r.latestPackage && (
            <p className="text-xs text-stone-500">
              Last packaged {new Date(r.latestPackage.builtAt).toLocaleString()}
            </p>
          )}
          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          )}
          {r.approvedPages === 0 && (
            <p className="text-xs text-stone-500">
              Approve at least one page in the{" "}
              <Link href={`${base}/images`} className="font-semibold underline">
                Images tab
              </Link>{" "}
              to enable the export.
            </p>
          )}
        </Card>
      </div>

      <Card className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-stone-900">
            Etsy printable pack
          </h2>
          <p className="text-xs text-stone-500">
            Sell the same book as an instant digital download: every approved
            page as a high-resolution PNG, one print-at-home PDF (US Letter,
            300 DPI, no book margins), and{" "}
            <code className="rounded bg-stone-100 px-1">etsy-listing.txt</code>{" "}
            with a download-focused title, up to 13 tags and a description.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            onClick={buildEtsy}
            disabled={etsyBuilding || r.approvedPages === 0}
          >
            {etsyBuilding ? "Packing…" : "Build Etsy Printable Pack"}
          </Button>
          {etsyDownload && (
            <a
              href={etsyDownload}
              className="text-sm font-semibold text-stone-900 underline underline-offset-2"
            >
              Download {etsyResult ? "Etsy pack" : "latest Etsy pack"}
            </a>
          )}
        </div>
        {etsyResult && (
          <p className="text-xs text-emerald-700">
            Packed {etsyResult.imageCount} pages ·{" "}
            {(etsyResult.bytes / 1024 / 1024).toFixed(1)} MB — tap Download above.
          </p>
        )}
        {oneDriveNote(etsyResult?.oneDrive)}
        {!etsyResult && r.latestEtsyPack && (
          <p className="text-xs text-stone-500">
            Last packed {new Date(r.latestEtsyPack.builtAt).toLocaleString()}
          </p>
        )}
      </Card>

      <Card>
        <h2 className="mb-1 text-base font-semibold text-stone-900">
          Uploading to Amazon KDP
        </h2>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-stone-600">
          <li>Go to kdp.amazon.com → Create → Paperback.</li>
          <li>Fill in the book details using <code className="rounded bg-stone-100 px-1">amazon-listing.txt</code>.</li>
          <li>Upload <code className="rounded bg-stone-100 px-1">interior/book-interior.pdf</code> as the manuscript.</li>
          <li>Upload <code className="rounded bg-stone-100 px-1">cover/book-cover.pdf</code> as the print-ready cover.</li>
          <li>Use KDP&apos;s previewer to confirm everything, then publish.</li>
        </ol>
      </Card>
    </div>
  );
}
