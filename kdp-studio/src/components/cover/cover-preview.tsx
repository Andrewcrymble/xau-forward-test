"use client";

/* eslint-disable @next/next/no-img-element */

// Scaled on-screen wraparound preview: [bleed | back | spine | front | bleed].
// Guides (trim, safe area, spine, barcode) are PREVIEW-ONLY — the exported
// PDF never contains them.

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { CoverDto, CoverSettings } from "@/lib/types";
import { BARCODE_AREA, COVER_SAFE_MARGIN_IN } from "@/lib/config/kdp-spec";
import { coverFont } from "@/lib/config/cover-fonts";

function hexToRgba(hex: string, alpha: number): string {
  const n = parseInt((/^#[0-9a-fA-F]{6}$/.test(hex) ? hex : "#000000").slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** CSS mirror of the PDF's outline / drop-shadow text treatments. */
function effectCss(
  effect: CoverSettings["textEffect"],
  colour: string,
  fontSizePx: number,
): CSSProperties {
  if (effect === "outline") {
    const o = Math.max(1, fontSizePx * 0.028);
    const c = hexToRgba(colour, 1);
    return {
      textShadow: [
        `${-o}px 0 ${c}`, `${o}px 0 ${c}`, `0 ${-o}px ${c}`, `0 ${o}px ${c}`,
        `${-o}px ${-o}px ${c}`, `${-o}px ${o}px ${c}`,
        `${o}px ${-o}px ${c}`, `${o}px ${o}px ${c}`,
      ].join(", "),
    };
  }
  if (effect === "shadow") {
    const d = Math.max(1, fontSizePx * 0.055);
    return { textShadow: `${d}px ${d}px ${d}px ${hexToRgba(colour, 0.6)}` };
  }
  return {};
}

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

  const textColor = /^#/.test(settings.textColor)
    ? settings.textColor
    : settings.textColor === "black" ? "#111111" : "#ffffff";
  const font = coverFont(settings.titleFont);
  const plate = settings.textEffect === "plate";
  const plateBg = plate ? hexToRgba(settings.effectColor, 0.72) : undefined;
  const align = settings.textAlign;
  const alignSelf =
    align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center";
  const justify =
    settings.titlePosition === "middle"
      ? "center"
      : settings.titlePosition === "bottom"
        ? "flex-end"
        : "flex-start";

  const guide = "absolute border border-dashed";

  // Back-cover showcase grid (mirrors the PDF layout maths): two stacked
  // thumbnails left, hero page right, row of four beneath, scaled to fit
  // above the barcode area. Slots are [xIn, topIn, wIn, hIn] from the top.
  const showcase = settings.backLayout === "showcase" && cover.showcasePages.length > 0;
  let showcaseSlots: Array<[number, number, number, number]> = [];
  if (showcase) {
    const R = 3300 / 2550;
    const gap = 0.15;
    const areaW = panelW - 2 * safe;
    const leftW = (areaW - gap * (1 + 1 / R)) / 3;
    const heroW = areaW - gap - leftW;
    const heroH = heroW * R;
    const rowW = (areaW - 3 * gap) / 4;
    const rowH = rowW * R;
    const naturalH = heroH + gap + rowH;
    const topIn = dims.bleedIn + safe;
    const bottomIn = settings.barcodeAreaClear
      ? dims.bleedIn + BARCODE_AREA.insetIn + BARCODE_AREA.heightIn
      : dims.bleedIn + safe;
    const s = Math.min(1, (dims.totalHeightIn - topIn - bottomIn - 0.15) / naturalH);
    const xOff = backX + safe + (areaW - areaW * s) / 2;
    showcaseSlots = [
      [xOff + (leftW + gap) * s, topIn, heroW * s, heroH * s],
      [xOff, topIn, leftW * s, leftW * R * s],
      [xOff, topIn + (leftW * R + gap) * s, leftW * s, leftW * R * s],
    ];
    for (let i = 0; i < 4; i++) {
      showcaseSlots.push([
        xOff + i * (rowW + gap) * s,
        topIn + (heroH + gap) * s,
        rowW * s,
        rowH * s,
      ]);
    }
    showcaseSlots = showcaseSlots.slice(0, cover.showcasePages.length);
  }

  return (
    <div
      ref={ref}
      className="relative w-full overflow-hidden rounded-lg shadow-md"
      style={{
        aspectRatio: `${dims.totalWidthIn} / ${dims.totalHeightIn}`,
        background: settings.backgroundColor,
      }}
    >
      {/* Optional back-cover artwork, darkened for readability */}
      {cover.artwork && settings.backArtwork && (
        <>
          <img
            src={cover.artwork}
            alt="Back cover artwork"
            className="absolute h-full object-cover"
            style={{ left: 0, width: pct(dims.bleedIn + panelW) }}
          />
          <div
            className="absolute h-full bg-black/50"
            style={{ left: 0, width: pct(dims.bleedIn + panelW) }}
          />
        </>
      )}

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
            alignSelf,
            maxWidth: "100%",
            ...(plate
              ? {
                  background: plateBg,
                  padding: `${settings.titleSize * 0.3 * scale}px ${settings.titleSize * 0.4 * scale}px`,
                }
              : {}),
          }}
        >
          <div
            style={{
              fontSize: settings.titleSize * scale,
              lineHeight: 1.2,
              fontWeight: 700,
              fontFamily: font.cssTitle,
              textTransform: settings.titleCase === "uppercase" ? "uppercase" : undefined,
              ...effectCss(settings.textEffect, settings.effectColor, settings.titleSize * scale),
            }}
          >
            {cover.title}
          </div>
          {cover.subtitle && (
            <div
              style={{
                fontSize: Math.max(14, settings.titleSize * 0.42) * scale,
                marginTop: 6 * scale,
                fontFamily: font.cssBody,
                ...effectCss(
                  settings.textEffect,
                  settings.effectColor,
                  Math.max(14, settings.titleSize * 0.42) * scale,
                ),
              }}
            >
              {cover.subtitle}
            </div>
          )}
        </div>
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
            fontFamily: font.cssBody,
            ...effectCss(
              settings.textEffect,
              settings.effectColor,
              Math.max(13, settings.titleSize * 0.38) * scale,
            ),
          }}
        >
          {plate ? (
            <span
              style={{
                display: "inline-block",
                background: plateBg,
                padding: `${4 * scale}px ${10 * scale}px`,
              }}
            >
              {cover.author}
            </span>
          ) : (
            cover.author
          )}
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
              fontFamily: font.cssTitle,
            }}
          >
            {cover.spineText}
          </span>
        </div>
      )}

      {/* Back cover: sample-page showcase grid */}
      {showcase &&
        showcaseSlots.map(([x, top, w, h], i) => (
          <div
            key={i}
            className="absolute bg-white"
            style={{
              left: pct(x),
              top: vpct(top),
              width: pct(w),
              height: vpct(h),
              padding: 0.05 * 72 * scale,
            }}
          >
            <img
              src={cover.showcasePages[i]}
              alt={`Sample page ${i + 1}`}
              className="h-full w-full object-cover"
            />
          </div>
        ))}

      {/* Back cover text */}
      {!showcase && cover.backCoverText && (
        <div
          className="absolute whitespace-pre-wrap text-center"
          style={{
            left: pct(backX + 2 * safe),
            width: pct(panelW - 4 * safe),
            top: vpct(dims.bleedIn + safe + 0.35),
            color: textColor,
            fontSize: settings.backTextSize * scale,
            lineHeight: 1.3,
            ...(settings.backTextPanel
              ? {
                  background: hexToRgba(settings.effectColor, 0.72),
                  padding: `${settings.backTextSize * 0.7 * scale}px ${settings.backTextSize * 0.9 * scale}px`,
                }
              : {}),
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
