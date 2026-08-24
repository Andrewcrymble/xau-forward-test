"use client";

/* eslint-disable @next/next/no-img-element */

// Scaled on-screen wraparound preview: [bleed | back | spine | front | bleed].
// Guides (trim, safe area, spine, barcode) are PREVIEW-ONLY — the exported
// PDF never contains them.

import { useEffect, useRef, useState } from "react";
import type { CoverDto } from "@/lib/types";
import { BARCODE_AREA, COVER_SAFE_MARGIN_IN } from "@/lib/config/kdp-spec";

export function CoverPreview({
  cover,
  showGuides,
}: {
  cover: CoverDto;
  showGuides: boolean;
}) {
  const { dims, settings } = cover;
  const ref = useRef<HTMLDivElement>(null);
  const [widthPx, setWidthPx] = useState(800);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      setWidthPx(entries[0].contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const pct = (inches: number) => `${(inches / dims.totalWidthIn) * 100}%`;
  const vpct = (inches: number) => `${(inches / dims.totalHeightIn) * 100}%`;
  /** Preview px per point (72pt = 1in). */
  const scale = widthPx / (dims.totalWidthIn * 72);

  const panelW = dims.trimWidthIn;
  const backX = dims.bleedIn;
  const spineX = dims.bleedIn + panelW;
  const frontX = dims.bleedIn + panelW + dims.spineIn;
  const safe = COVER_SAFE_MARGIN_IN;

  const textColor = settings.textColor === "black" ? "#111" : "#fff";
  const align = settings.textAlign;
  const justify =
    settings.titlePosition === "middle"
      ? "center"
      : settings.titlePosition === "bottom"
        ? "flex-end"
        : "flex-start";

  const guide = "absolute border border-dashed";

  return (
    <div
      ref={ref}
      className="relative w-full overflow-hidden rounded-lg shadow-md"
      style={{
        aspectRatio: `${dims.totalWidthIn} / ${dims.totalHeightIn}`,
        background: settings.backgroundColor,
      }}
    >
      {/* Front artwork (fills front panel + outer bleed) */}
      {cover.artwork && (
        <img
          src={cover.artwork}
          alt="Front cover artwork"
          className="absolute h-full object-cover"
          style={{ left: pct(frontX), width: pct(panelW + dims.bleedIn) }}
        />
      )}

      {/* Front typography */}
      <div
        className="absolute flex h-full flex-col"
        style={{
          left: pct(frontX + safe),
          width: pct(panelW - 2 * safe),
          paddingTop: vpct(dims.bleedIn + safe),
          paddingBottom: vpct(dims.bleedIn + safe),
          justifyContent: justify,
          textAlign: align,
          color: textColor,
        }}
      >
        <div
          style={{
            fontSize: settings.titleSize * scale,
            lineHeight: 1.2,
            fontWeight: 700,
            fontFamily: settings.titleFont === "sans" ? "Arial, sans-serif" : "Georgia, serif",
          }}
        >
          {cover.title}
        </div>
        {cover.subtitle && (
          <div
            style={{
              fontSize: Math.max(14, settings.titleSize * 0.42) * scale,
              marginTop: 6 * scale,
              fontFamily: settings.titleFont === "sans" ? "Arial, sans-serif" : "Georgia, serif",
            }}
          >
            {cover.subtitle}
          </div>
        )}
      </div>
      {cover.author && (
        <div
          className="absolute"
          style={{
            left: pct(frontX + safe),
            width: pct(panelW - 2 * safe),
            ...(settings.titlePosition === "bottom"
              ? { top: vpct(dims.bleedIn + safe) }
              : { bottom: vpct(dims.bleedIn + safe) }),
            textAlign: align,
            color: textColor,
            fontSize: Math.max(13, settings.titleSize * 0.38) * scale,
            fontFamily: settings.titleFont === "sans" ? "Arial, sans-serif" : "Georgia, serif",
          }}
        >
          {cover.author}
        </div>
      )}

      {/* Spine text */}
      {cover.spineText && dims.spineTextAllowed && (
        <div
          className="absolute flex items-center justify-center"
          style={{ left: pct(spineX), width: pct(dims.spineIn), top: 0, bottom: 0 }}
        >
          <span
            className="whitespace-nowrap font-bold"
            style={{
              color: textColor,
              fontSize: Math.min(16, dims.spineIn * 72 * 0.55) * scale,
              transform: "rotate(90deg)",
            }}
          >
            {cover.spineText}
          </span>
        </div>
      )}

      {/* Back cover text */}
      {cover.backCoverText && (
        <div
          className="absolute whitespace-pre-wrap text-center"
          style={{
            left: pct(backX + 2 * safe),
            width: pct(panelW - 4 * safe),
            top: vpct(dims.bleedIn + safe + 0.35),
            color: textColor,
            fontSize: 13 * scale,
            lineHeight: 1.35,
          }}
        >
          {cover.backCoverText}
        </div>
      )}

      {/* Barcode clear area */}
      {settings.barcodeAreaClear && (
        <div
          className="absolute flex items-center justify-center bg-white"
          style={{
            left: pct(backX + panelW - BARCODE_AREA.insetIn - BARCODE_AREA.widthIn),
            width: pct(BARCODE_AREA.widthIn),
            bottom: vpct(dims.bleedIn + BARCODE_AREA.insetIn),
            height: vpct(BARCODE_AREA.heightIn),
          }}
        >
          {showGuides && (
            <span className="text-[9px] text-stone-400">Amazon barcode</span>
          )}
        </div>
      )}

      {/* Guides — preview only */}
      {showGuides && (
        <>
          {/* Trim line */}
          <div
            className={`${guide} border-red-400/80`}
            style={{
              left: pct(dims.bleedIn),
              right: pct(dims.bleedIn),
              top: vpct(dims.bleedIn),
              bottom: vpct(dims.bleedIn),
            }}
            title="Trim line"
          />
          {/* Spine edges */}
          <div
            className={`${guide} border-y-0 border-blue-400/80`}
            style={{ left: pct(spineX), width: pct(dims.spineIn), top: 0, bottom: 0 }}
            title="Spine"
          />
          {/* Safe areas */}
          {[backX, frontX].map((x) => (
            <div
              key={x}
              className={`${guide} border-emerald-400/70`}
              style={{
                left: pct(x + safe),
                width: pct(panelW - 2 * safe),
                top: vpct(dims.bleedIn + safe),
                bottom: vpct(dims.bleedIn + safe),
              }}
              title="Safe text area"
            />
          ))}
        </>
      )}
    </div>
  );
}
