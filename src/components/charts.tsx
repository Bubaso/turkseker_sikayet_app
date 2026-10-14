/* ===========================================================================
   Satır içi SVG grafik bileşenleri.
   Kurallar: tek ölçü tek renk (nominal kategorilerde değer rampası yok),
   çift eksen yok, ince işaretler (çubuk <=24px, çizgi 2px, nokta r>=4 ve 2px
   zemin halkası), ince ve düz kılavuz çizgileri, metin asla seri renginde
   değil, iki ve daha fazla seride gösterge + doğrudan etiket, her grafikte
   tablo görünümü. Renk paleti globals.css içindeki .viz belirteçlerinden gelir.
   =========================================================================== */

import type { ReactNode } from "react";

const nf = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 });
const fmt = (v: number) => nf.format(v);

/** Eksen için okunabilir üst sınır ve adım. */
function niceScale(max: number, ticks = 4): { max: number; step: number } {
  if (max <= 0) return { max: 1, step: 1 };
  const raw = max / ticks;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  return { max: Math.ceil(max / step) * step, step };
}

function compact(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${fmt(v / 1_000_000)}M`;
  if (Math.abs(v) >= 1000) return `${fmt(v / 1000)}B`;
  return fmt(v);
}

/* --- Yatay çubuk grafiği -------------------------------------------------- */

export interface BarRow {
  label: string;
  value: number;
  /** İpucu metni. */
  hint?: string;
}

/**
 * Tek ölçünün kategoriler arası karşılaştırması.
 * Kategoriler nominal olduğu için tüm çubuklar aynı rengi taşır.
 */
export function BarChartH({
  rows, unit = "", labelWidth = 96, caption,
}: {
  rows: BarRow[];
  unit?: string;
  labelWidth?: number;
  caption: string;
}) {
  if (rows.length === 0) {
    return <p className="px-4 py-6 text-center text-sm text-ink-500">Grafik için veri yok.</p>;
  }
  const BAR = 14;
  const GAP = 12;
  const PAD_T = 18;
  const PAD_B = 22;
  const PAD_R = 54;
  const W = 640;
  const H = PAD_T + rows.length * (BAR + GAP) + PAD_B;
  const plotW = W - labelWidth - PAD_R;
  const { max, step } = niceScale(Math.max(...rows.map((r) => r.value)));
  const x = (v: number) => labelWidth + (v / max) * plotW;
  const ticks = Array.from({ length: Math.floor(max / step) + 1 }, (_, i) => i * step);

  return (
    <figure className="viz m-0">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img"
           aria-label={caption} style={{ maxHeight: H }}>
        {/* Kılavuz çizgileri — ince, düz, geri planda */}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} y1={PAD_T - 6} x2={x(t)} y2={H - PAD_B}
                  stroke="var(--viz-grid)" strokeWidth="1" />
            <text x={x(t)} y={H - PAD_B + 14} textAnchor="middle"
                  fill="var(--viz-muted)" fontSize="10" style={{ fontVariantNumeric: "tabular-nums" }}>
              {compact(t)}
            </text>
          </g>
        ))}
        <line x1={labelWidth} y1={PAD_T - 6} x2={labelWidth} y2={H - PAD_B}
              stroke="var(--viz-axis)" strokeWidth="1" />

        {rows.map((r, i) => {
          const y = PAD_T + i * (BAR + GAP);
          const w = Math.max(r.value > 0 ? 2 : 0, x(r.value) - labelWidth);
          return (
            <g key={r.label}>
              <title>{r.hint ?? `${r.label}: ${fmt(r.value)} ${unit}`.trim()}</title>
              {/* Vurgu alanı — fare hedefini işaretten büyük tutar */}
              <rect x={0} y={y - GAP / 2} width={W} height={BAR + GAP} fill="transparent" />
              <text x={labelWidth - 8} y={y + BAR / 2 + 3.5} textAnchor="end"
                    fill="var(--viz-ink-2)" fontSize="11">
                {r.label}
              </text>
              {r.value > 0 && (
                <rect x={labelWidth} y={y} width={w} height={BAR}
                      fill="var(--viz-s1)" rx="4"
                      style={{ clipPath: `inset(0 0 0 0)` }} />
              )}
              {/* Tabandaki köşeyi kare tutmak için küçük dolgu */}
              {r.value > 0 && <rect x={labelWidth} y={y} width={Math.min(4, w)} height={BAR} fill="var(--viz-s1)" />}
              <text x={x(r.value) + 7} y={y + BAR / 2 + 3.5}
                    fill="var(--viz-ink)" fontSize="11" fontWeight="600"
                    style={{ fontVariantNumeric: "tabular-nums" }}>
                {fmt(r.value)}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-1.5 text-xs text-ink-500">{caption}</figcaption>
    </figure>
  );
}

/* --- Çizgi grafiği -------------------------------------------------------- */

export interface Series {
  name: string;
  values: number[];
  /** 1 | 2 | 3 — kategorik slot. Sıra sabittir, döngüye alınmaz. */
  slot: 1 | 2 | 3;
}

const SLOT_VAR = { 1: "var(--viz-s1)", 2: "var(--viz-s2)", 3: "var(--viz-s3)" } as const;

/** Zaman içindeki değişim. En çok 3 seri; daha fazlası için küçük çoklular. */
export function LineChart({
  labels, series, caption,
}: {
  labels: string[];
  series: Series[];
  caption: string;
}) {
  if (labels.length === 0 || series.length === 0) {
    return <p className="px-4 py-6 text-center text-sm text-ink-500">Grafik için veri yok.</p>;
  }
  const W = 680;
  const H = 240;
  const PAD = { t: 14, r: 56, b: 30, l: 36 };
  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;
  const allMax = Math.max(1, ...series.flatMap((s) => s.values));
  const { max, step } = niceScale(allMax);
  const x = (i: number) =>
    PAD.l + (labels.length === 1 ? plotW / 2 : (i / (labels.length - 1)) * plotW);
  const y = (v: number) => PAD.t + plotH - (v / max) * plotH;
  const ticks = Array.from({ length: Math.floor(max / step) + 1 }, (_, i) => i * step);
  const tickEvery = Math.ceil(labels.length / 12);

  return (
    <figure className="viz m-0">
      {/* Gösterge — iki ve daha fazla seride her zaman var */}
      {series.length > 1 && (
        <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1">
          {series.map((s) => (
            <li key={s.name} className="flex items-center gap-1.5 text-xs text-ink-600">
              <span className="inline-block h-0.5 w-4 rounded" style={{ background: SLOT_VAR[s.slot] }} aria-hidden />
              {s.name}
            </li>
          ))}
        </ul>
      )}

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label={caption}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} y1={y(t)} x2={W - PAD.r} y2={y(t)}
                  stroke="var(--viz-grid)" strokeWidth="1" />
            <text x={PAD.l - 6} y={y(t) + 3.5} textAnchor="end"
                  fill="var(--viz-muted)" fontSize="10" style={{ fontVariantNumeric: "tabular-nums" }}>
              {compact(t)}
            </text>
          </g>
        ))}
        <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={PAD.t + plotH}
              stroke="var(--viz-axis)" strokeWidth="1" />

        {labels.map((l, i) =>
          i % tickEvery === 0 ? (
            <text key={l} x={x(i)} y={H - PAD.b + 16} textAnchor="middle"
                  fill="var(--viz-muted)" fontSize="10">
              {l}
            </text>
          ) : null,
        )}

        {series.map((s) => {
          const d = s.values
            .map((v, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`)
            .join(" ");
          const lastI = s.values.length - 1;
          return (
            <g key={s.name}>
              <path d={d} fill="none" stroke={SLOT_VAR[s.slot]} strokeWidth="2"
                    strokeLinejoin="round" strokeLinecap="round" />
              {s.values.map((v, i) => (
                <circle key={i} cx={x(i)} cy={y(v)} r="4.5"
                        fill={SLOT_VAR[s.slot]} stroke="var(--viz-surface)" strokeWidth="2">
                  <title>{`${s.name} — ${labels[i]}: ${fmt(v)}`}</title>
                </circle>
              ))}
              {/* Doğrudan uç etiketi — metin ink belirtecinde, seri renginde değil */}
              <text x={x(lastI) + 9} y={y(s.values[lastI]!) + 3.5}
                    fill="var(--viz-ink)" fontSize="11" fontWeight="600"
                    style={{ fontVariantNumeric: "tabular-nums" }}>
                {fmt(s.values[lastI]!)}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-1.5 text-xs text-ink-500">{caption}</figcaption>
    </figure>
  );
}

/* --- Yığılmış yatay çubuk (parça-bütün) ---------------------------------- */

export interface StackSegment {
  name: string;
  value: number;
  slot: 1 | 2 | 3;
}

export interface StackRow {
  label: string;
  segments: StackSegment[];
}

/** Parça-bütün karşılaştırması. Segmentler arasında 2px zemin boşluğu bırakılır. */
export function StackedBarH({
  rows, legend, caption, labelWidth = 150,
}: {
  rows: StackRow[];
  legend: { name: string; slot: 1 | 2 | 3 }[];
  caption: string;
  labelWidth?: number;
}) {
  if (rows.length === 0) {
    return <p className="px-4 py-6 text-center text-sm text-ink-500">Grafik için veri yok.</p>;
  }
  const BAR = 16;
  const GAP = 14;
  const W = 640;
  const PAD_T = 6;
  const PAD_R = 46;
  const H = PAD_T + rows.length * (BAR + GAP);
  const plotW = W - labelWidth - PAD_R;

  return (
    <figure className="viz m-0">
      <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1">
        {legend.map((l) => (
          <li key={l.name} className="flex items-center gap-1.5 text-xs text-ink-600">
            <span className="inline-block size-2.5 rounded-sm" style={{ background: SLOT_VAR[l.slot] }} aria-hidden />
            {l.name}
          </li>
        ))}
      </ul>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label={caption}>
        {rows.map((r, i) => {
          const total = r.segments.reduce((a, s) => a + s.value, 0);
          const y = PAD_T + i * (BAR + GAP);
          let cursor = labelWidth;
          return (
            <g key={r.label}>
              <text x={labelWidth - 8} y={y + BAR / 2 + 3.5} textAnchor="end"
                    fill="var(--viz-ink-2)" fontSize="11">
                {r.label}
              </text>
              {total === 0 ? (
                <rect x={labelWidth} y={y} width={plotW} height={BAR} fill="var(--viz-grid)" rx="2" />
              ) : (
                r.segments.map((s) => {
                  if (s.value <= 0) return null;
                  const w = (s.value / total) * plotW;
                  const px = cursor;
                  cursor += w;
                  // Segmentler arasına 2px zemin boşluğu
                  const drawW = Math.max(1, w - 2);
                  return (
                    <rect key={s.name} x={px} y={y} width={drawW} height={BAR}
                          fill={SLOT_VAR[s.slot]} rx="2">
                      <title>
                        {`${r.label} — ${s.name}: ${fmt(s.value)} (${Math.round((s.value / total) * 100)}%)`}
                      </title>
                    </rect>
                  );
                })
              )}
              <text x={W - PAD_R + 8} y={y + BAR / 2 + 3.5}
                    fill="var(--viz-ink)" fontSize="11" fontWeight="600"
                    style={{ fontVariantNumeric: "tabular-nums" }}>
                {total > 0 ? `${Math.round(((r.segments[0]?.value ?? 0) / total) * 100)}%` : "—"}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-1.5 text-xs text-ink-500">{caption}</figcaption>
    </figure>
  );
}

/* --- Ölçer (orana karşı sınır) ------------------------------------------- */

export type MeterBand = "good" | "warning" | "critical" | "none";

export function bandOf(rate: number | null): MeterBand {
  if (rate == null) return "none";
  if (rate >= 95) return "good";
  if (rate >= 85) return "warning";
  return "critical";
}

/** Ölçer bandının Chip tonu karşılığı — kart ve listelerde aynı anlam. */
export function bandTone(band: MeterBand): "ok" | "warn" | "danger" | "ink" {
  return band === "good" ? "ok" : band === "warning" ? "warn"
    : band === "critical" ? "danger" : "ink";
}

const BAND_FILL: Record<MeterBand, string> = {
  good: "var(--viz-good)",
  warning: "var(--viz-warn)",
  critical: "var(--viz-critical)",
  none: "var(--viz-grid)",
};
const BAND_TRACK: Record<MeterBand, string> = {
  good: "#d9f2d9",
  warning: "#fdeeca",
  critical: "#f6d8d8",
  none: "#e2e8f0",
};
const BAND_ICON: Record<MeterBand, string> = {
  good: "✓", warning: "!", critical: "×", none: "–",
};
const BAND_LABEL: Record<MeterBand, string> = {
  good: "Hedefte",
  warning: "Dikkat",
  critical: "Hedef altı",
  none: "Veri yok",
};

/**
 * Bir orana karşı sınır göstergesi. Renk durum anlamı taşıdığı için durum
 * paleti kullanılır; renk tek başına anlam taşımasın diye ikon ve metin
 * etiketi her zaman birlikte gösterilir.
 */
export function Meter({
  label, rate, hint,
}: {
  label: string;
  /** Yüzde (0-100) ya da bilinmiyorsa null. */
  rate: number | null;
  hint?: ReactNode;
}) {
  const band = bandOf(rate);
  return (
    <div className="viz">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-medium text-ink-700" title={label}>{label}</span>
        <span className="flex shrink-0 items-center gap-1.5">
          <span aria-hidden className="flex size-4 items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={{ background: BAND_FILL[band] }}>
            {BAND_ICON[band]}
          </span>
          <span className="text-xs text-ink-600">{BAND_LABEL[band]}</span>
          <span className="tnum text-sm font-semibold text-ink-900">
            {rate == null ? "—" : `%${fmt(rate)}`}
          </span>
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full" style={{ background: BAND_TRACK[band] }}>
        <div className="h-full rounded-full"
             style={{ width: `${Math.max(0, Math.min(100, rate ?? 0))}%`, background: BAND_FILL[band] }} />
      </div>
      {hint && <p className="mt-0.5 text-xs text-ink-500">{hint}</p>}
    </div>
  );
}

/* --- Tablo görünümü ------------------------------------------------------ */

/** Her grafiğin yanında açılabilir tablo — erişilebilirlik gereği. */
export function TableView({
  headers, rows, title = "Tablo görünümü",
}: {
  headers: string[];
  rows: (string | number)[][];
  title?: string;
}) {
  return (
    <details className="mt-3 border-t border-ink-100 pt-2">
      <summary className="cursor-pointer text-xs font-medium text-brand-600 hover:underline">
        {title}
      </summary>
      <div className="table-wrap mt-2">
        <table className="tbl">
          <thead>
            <tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {r.map((cell, j) => (
                  <td key={j} className={typeof cell === "number" ? "tnum text-right" : undefined}>
                    {typeof cell === "number" ? fmt(cell) : cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
