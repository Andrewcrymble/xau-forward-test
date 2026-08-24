// Miniature line-art previews for each illustration style and complexity
// level. Hand-drawn SVGs (white ground, black strokes) so the setup screens
// can show what a choice looks like without any API calls.

const FRAME = { viewBox: "0 0 120 160", className: "h-full w-full" } as const;

function Svg({ children }: { children: React.ReactNode }) {
  return (
    <svg
      {...FRAME}
      role="img"
      aria-hidden="true"
      style={{ background: "#fff" }}
      fill="none"
      stroke="#111"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

function CleanChildrens() {
  return (
    <Svg>
      <circle cx="88" cy="34" r="14" strokeWidth="3" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
        <line
          key={a}
          x1={88 + 19 * Math.cos((a * Math.PI) / 180)}
          y1={34 + 19 * Math.sin((a * Math.PI) / 180)}
          x2={88 + 26 * Math.cos((a * Math.PI) / 180)}
          y2={34 + 26 * Math.sin((a * Math.PI) / 180)}
          strokeWidth="3"
        />
      ))}
      <path d="M20 150 q10 -40 8 -62" strokeWidth="3" />
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse
          key={a}
          cx={28 + 14 * Math.cos(((a - 90) * Math.PI) / 180)}
          cy={74 + 14 * Math.sin(((a - 90) * Math.PI) / 180)}
          rx="9"
          ry="6"
          strokeWidth="3"
          transform={`rotate(${a} ${28 + 14 * Math.cos(((a - 90) * Math.PI) / 180)} ${74 + 14 * Math.sin(((a - 90) * Math.PI) / 180)})`}
        />
      ))}
      <circle cx="28" cy="74" r="6" strokeWidth="3" />
      <path d="M8 150 q52 -14 104 0" strokeWidth="3" />
    </Svg>
  );
}

function CuteCartoon() {
  return (
    <Svg>
      <circle cx="60" cy="78" r="34" strokeWidth="3.5" />
      <circle cx="38" cy="48" r="12" strokeWidth="3.5" />
      <circle cx="82" cy="48" r="12" strokeWidth="3.5" />
      <circle cx="38" cy="48" r="5" strokeWidth="2.5" />
      <circle cx="82" cy="48" r="5" strokeWidth="2.5" />
      <circle cx="48" cy="74" r="5.5" strokeWidth="3" />
      <circle cx="72" cy="74" r="5.5" strokeWidth="3" />
      <ellipse cx="60" cy="88" rx="7" ry="5" strokeWidth="3" />
      <path d="M53 98 q7 6 14 0" strokeWidth="3" />
      <path d="M30 130 q30 18 60 0" strokeWidth="3.5" />
      <circle cx="34" cy="122" r="4" strokeWidth="2.5" />
      <circle cx="86" cy="122" r="4" strokeWidth="2.5" />
    </Svg>
  );
}

function BoldSimple() {
  return (
    <Svg>
      <path
        d="M60 26 l9 22 24 2 -18 16 6 23 -21 -13 -21 13 6 -23 -18 -16 24 -2 z"
        strokeWidth="6"
      />
      <path d="M26 118 q34 -18 68 0 q-34 18 -68 0 z" strokeWidth="6" />
      <circle cx="80" cy="115" r="2.5" strokeWidth="4" />
    </Svg>
  );
}

function DetailedRealistic() {
  return (
    <Svg>
      <path d="M60 12 q34 42 0 136 q-34 -94 0 -136 z" strokeWidth="1.6" />
      <path d="M60 20 l0 118" strokeWidth="1.2" />
      {[34, 48, 62, 76, 90, 104, 118].map((y, i) => (
        <g key={y} strokeWidth="1">
          <path d={`M60 ${y} q-${10 + i} 6 -${14 + i} 14`} />
          <path d={`M60 ${y} q${10 + i} 6 ${14 + i} 14`} />
        </g>
      ))}
      {[41, 55, 69, 83, 97].map((y) => (
        <g key={y} strokeWidth="0.7">
          <path d={`M60 ${y} q-7 4 -9 9`} />
          <path d={`M60 ${y} q7 4 9 9`} />
        </g>
      ))}
    </Svg>
  );
}

function Architectural() {
  return (
    <Svg>
      <path d="M18 150 v-74 l42 -30 42 30 v74" strokeWidth="2" />
      <path d="M12 150 h96" strokeWidth="2" />
      <path d="M24 76 h72" strokeWidth="1.5" />
      <path d="M60 46 l-42 30 M60 46 l42 30" strokeWidth="1.2" />
      {[32, 52, 72, 92].map((x) => (
        <g key={x} strokeWidth="1.5">
          <rect x={x - 5} y="88" width="10" height="20" rx="4" />
          <line x1={x} y1="88" x2={x} y2="108" strokeWidth="0.8" />
        </g>
      ))}
      <rect x="50" y="122" width="20" height="28" rx="8" strokeWidth="1.5" />
      {[26, 42, 58, 74, 90].map((x) => (
        <line key={x} x1={x + 2} y1="116" x2={x + 2} y2="150" strokeWidth="1" />
      ))}
      <circle cx="60" cy="62" r="6" strokeWidth="1.2" />
    </Svg>
  );
}

function Mandala() {
  const cx = 60, cy = 80;
  return (
    <Svg>
      <circle cx={cx} cy={cy} r="10" strokeWidth="1.4" />
      <circle cx={cx} cy={cy} r="22" strokeWidth="1.2" />
      <circle cx={cx} cy={cy} r="36" strokeWidth="1.2" />
      <circle cx={cx} cy={cy} r="50" strokeWidth="1.4" />
      {Array.from({ length: 12 }, (_, i) => i * 30).map((a) => {
        const r1 = 22, r2 = 36;
        const x1 = cx + r1 * Math.cos((a * Math.PI) / 180);
        const y1 = cy + r1 * Math.sin((a * Math.PI) / 180);
        const x2 = cx + r2 * Math.cos((a * Math.PI) / 180);
        const y2 = cy + r2 * Math.sin((a * Math.PI) / 180);
        return <line key={a} x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth="0.9" />;
      })}
      {Array.from({ length: 8 }, (_, i) => i * 45).map((a) => {
        const x = cx + 43 * Math.cos((a * Math.PI) / 180);
        const y = cy + 43 * Math.sin((a * Math.PI) / 180);
        return <circle key={a} cx={x} cy={y} r="6" strokeWidth="0.9" />;
      })}
      {Array.from({ length: 8 }, (_, i) => i * 45 + 22.5).map((a) => {
        const x = cx + 16 * Math.cos((a * Math.PI) / 180);
        const y = cy + 16 * Math.sin((a * Math.PI) / 180);
        return (
          <ellipse key={a} cx={x} cy={y} rx="4" ry="7" strokeWidth="0.8"
            transform={`rotate(${a + 90} ${x} ${y})`} />
        );
      })}
    </Svg>
  );
}

function Vintage() {
  return (
    <Svg>
      <path d="M18 60 h84 l-8 12 8 12 h-84 l8 -12 z" strokeWidth="1.8" />
      {[24, 30, 36, 42, 48, 54, 60, 66, 72, 78, 84, 90, 96].map((x) => (
        <line key={x} x1={x} y1="64" x2={x - 3} y2="80" strokeWidth="0.6" />
      ))}
      <path d="M60 96 q-26 10 -36 34" strokeWidth="1.6" />
      <path d="M60 96 q26 10 36 34" strokeWidth="1.6" />
      <path d="M24 130 q6 -8 14 -8 M96 130 q-6 -8 -14 -8" strokeWidth="1.2" />
      <path d="M60 96 v34" strokeWidth="1.2" />
      <path d="M40 34 q20 -16 40 0 q-8 8 -20 8 q-12 0 -20 -8 z" strokeWidth="1.4" />
      {[46, 52, 58, 64, 70].map((x) => (
        <line key={x} x1={x} y1="26" x2={x + 2} y2="38" strokeWidth="0.6" />
      ))}
    </Svg>
  );
}

function CustomStyle() {
  return (
    <Svg>
      <path d="M34 126 l58 -78 12 9 -58 78 -16 6 z" strokeWidth="2.5" />
      <path d="M88 42 l12 9" strokeWidth="2.5" />
      <path d="M38 118 l12 9" strokeWidth="1.5" />
      <path d="M22 40 l0 -16 M14 32 l16 0" strokeWidth="2.5" />
      <path d="M100 120 l0 -12 M94 114 l12 0" strokeWidth="2" />
      <path d="M28 78 l0 -10 M23 73 l10 0" strokeWidth="1.8" />
    </Svg>
  );
}

const STYLE_PREVIEWS: Record<string, () => React.ReactNode> = {
  clean_childrens: CleanChildrens,
  cute_cartoon: CuteCartoon,
  bold_simple: BoldSimple,
  detailed_realistic: DetailedRealistic,
  architectural: Architectural,
  mandala: Mandala,
  vintage: Vintage,
  custom: CustomStyle,
};

export function StylePreview({ styleId }: { styleId: string }) {
  const Preview = STYLE_PREVIEWS[styleId] ?? CustomStyle;
  return <Preview />;
}

/** Complexity preview: the same flower drawn with increasing detail. */
export function ComplexityPreview({ level }: { level: number }) {
  // level 0..4 → petals, rings and stroke weight change together.
  const petals = [5, 6, 8, 12, 16][level] ?? 8;
  const stroke = [5, 4, 2.6, 1.6, 1][level] ?? 2.6;
  const rings = [0, 0, 1, 2, 3][level] ?? 1;
  const cx = 60, cy = 80;
  return (
    <Svg>
      <circle cx={cx} cy={cy} r="12" strokeWidth={stroke} />
      {Array.from({ length: petals }, (_, i) => (i * 360) / petals).map((a) => {
        const x = cx + 26 * Math.cos((a * Math.PI) / 180);
        const y = cy + 26 * Math.sin((a * Math.PI) / 180);
        return (
          <ellipse key={a} cx={x} cy={y} rx="8" ry="13" strokeWidth={stroke}
            transform={`rotate(${a + 90} ${x} ${y})`} />
        );
      })}
      {rings >= 1 && <circle cx={cx} cy={cy} r="46" strokeWidth={stroke * 0.8} />}
      {rings >= 2 &&
        Array.from({ length: petals }, (_, i) => (i * 360) / petals + 180 / petals).map((a) => {
          const x = cx + 46 * Math.cos((a * Math.PI) / 180);
          const y = cy + 46 * Math.sin((a * Math.PI) / 180);
          return <circle key={a} cx={x} cy={y} r="4" strokeWidth={stroke * 0.8} />;
        })}
      {rings >= 3 && <circle cx={cx} cy={cy} r="6" strokeWidth={stroke} />}
      {rings >= 3 &&
        Array.from({ length: petals * 2 }, (_, i) => (i * 360) / (petals * 2)).map((a) => (
          <line
            key={a}
            x1={cx + 52 * Math.cos((a * Math.PI) / 180)}
            y1={cy + 52 * Math.sin((a * Math.PI) / 180)}
            x2={cx + 56 * Math.cos((a * Math.PI) / 180)}
            y2={cy + 56 * Math.sin((a * Math.PI) / 180)}
            strokeWidth={stroke}
          />
        ))}
    </Svg>
  );
}
