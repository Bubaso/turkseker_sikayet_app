import Link from "next/link";
import type { ReactNode } from "react";
import {
  STATUS_LABEL, STATUS_SHORT_LABEL, STATUS_TONE, type Status,
} from "@/lib/domain";
import { SLA_TONE, type SlaInfo } from "@/lib/dates";

/* --- Renk tonları -------------------------------------------------------- */

export type Tone = "ink" | "info" | "warn" | "danger" | "ok" | "brand";

const TONE_CLASS: Record<Tone, string> = {
  ink: "border-ink-200 bg-ink-100 text-ink-700",
  info: "border-info-200 bg-info-50 text-info-600",
  warn: "border-warn-200 bg-warn-50 text-warn-700",
  danger: "border-danger-200 bg-danger-50 text-danger-700",
  ok: "border-ok-200 bg-ok-50 text-ok-700",
  /*
   * Marka rozeti dolu çizilir. Marka rengi artık kurumsal yeşil olduğu için
   * açık yeşil zeminli bir marka rozeti, "haklı / kapandı / süresinde" gibi
   * yeşil durum rozetleriyle aynı görünüyordu. Dolu zemin, rozetin bir durum
   * değil işaret olduğunu renkten bağımsız olarak da söyler.
   */
  brand: "border-brand-600 bg-brand-600 text-white",
};

const DOT_CLASS: Record<Tone, string> = {
  ink: "bg-ink-400",
  info: "bg-info-600",
  warn: "bg-warn-600",
  danger: "bg-danger-600",
  ok: "bg-ok-600",
  brand: "bg-white",
};

export function Chip({
  children, tone = "ink", dot = false, title,
}: {
  children: ReactNode; tone?: Tone; dot?: boolean; title?: string;
}) {
  return (
    <span className={`chip ${TONE_CLASS[tone]}`} title={title}>
      {dot && <span className={`size-1.5 rounded-full ${DOT_CLASS[tone]}`} aria-hidden />}
      {children}
    </span>
  );
}

export function StatusChip({ status, kisa = false }: { status: string; kisa?: boolean }) {
  const s = status as Status;
  const tam = STATUS_LABEL[s] ?? status;
  return (
    <Chip tone={STATUS_TONE[s] ?? "ink"} dot title={kisa ? tam : undefined}>
      {kisa ? (STATUS_SHORT_LABEL[s] ?? tam) : tam}
    </Chip>
  );
}

export function SlaChip({ sla, compact = false }: { sla: SlaInfo; compact?: boolean }) {
  if (sla.state === "YOK") return <span className="text-ink-400">—</span>;
  return (
    <Chip tone={SLA_TONE[sla.state]} dot={!compact} title={sla.dueAt ? `Son tarih: ${sla.dueAt}` : undefined}>
      {sla.label}
    </Chip>
  );
}

export function VerdictChip({ verdict, bosGizle = false, nokta = true }: {
  verdict: string | null;
  /** Karar yoksa hiç çizme. Tabloda sütun hizası için tire gerekir, kartta
      yalnız bir tire anlamsız durur. */
  bosGizle?: boolean;
  /** Durum rozetinin yanında dururken nokta gereksiz: yan yana iki nokta
      gürültü yapıyor ve rozeti satıra sığmayacak kadar genişletiyor. */
  nokta?: boolean;
}) {
  if (!verdict) return bosGizle ? null : <span className="text-ink-400">—</span>;
  const ok = verdict === "HAKLI";
  return (
    <Chip tone={ok ? "ok" : "ink"} dot={nokta}
          title={ok ? "Şikâyet haklı bulundu" : "Şikâyet haklı bulunmadı"}>
      {ok ? "Haklı" : "Haksız"}
    </Chip>
  );
}

/* --- Yerleşim ------------------------------------------------------------ */

export function Card({
  title, actions, children, className = "", bodyClass = "p-4 sm:p-5",
}: {
  title?: ReactNode; actions?: ReactNode; children: ReactNode;
  className?: string; bodyClass?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {title && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-200 px-4 py-2.5">
          <h2 className="text-baslik font-semibold tracking-wide text-ink-700 uppercase">{title}</h2>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}

export function PageHeader({
  title, subtitle, actions, breadcrumb,
}: {
  title: ReactNode; subtitle?: ReactNode; actions?: ReactNode;
  breadcrumb?: { href: string; label: string }[];
}) {
  return (
    <header className="mb-5">
      {breadcrumb && breadcrumb.length > 0 && (
        <nav className="mb-1.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-500">
          {breadcrumb.map((b, i) => (
            <span key={b.href} className="flex items-center gap-1.5">
              {i > 0 && <span aria-hidden>/</span>}
              <Link href={b.href}
                    className="inline-flex min-h-6 items-center hover:text-brand-600 hover:underline">
                {b.label}
              </Link>
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-ink-900">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-ink-600">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

export function EmptyState({ title, hint, icon }: { title: string; hint?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 px-4 py-10 text-center">
      {icon && <div className="mb-1 text-ink-300">{icon}</div>}
      <p className="text-sm font-medium text-ink-700">{title}</p>
      {hint && <p className="max-w-md text-sm text-ink-500">{hint}</p>}
    </div>
  );
}

/** Etiket / değer çiftlerinden oluşan özet listesi. */
export function DefList({
  items, cols = 2,
}: {
  items: { label: string; value: ReactNode; wide?: boolean }[];
  cols?: 1 | 2 | 3;
}) {
  const grid = cols === 1 ? "sm:grid-cols-1" : cols === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2";
  return (
    <dl className={`grid grid-cols-1 gap-x-6 gap-y-3 ${grid}`}>
      {items.map((it, i) => (
        <div key={i} className={it.wide ? "sm:col-span-full" : undefined}>
          <dt className="text-xs font-medium tracking-wide text-ink-500 uppercase">{it.label}</dt>
          <dd className="mt-0.5 text-sm break-words text-ink-900">{it.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

/*
 * Pano sayı kutusu.
 *
 * Marka yeşili bilinçli olarak dışarıda bırakılmıştır: bir sayıda yeşil
 * "iyi" demektir (ok tonu) ve marka rengi de yeşil olduğu için ikisi yan yana
 * ayırt edilemez. Kural tek cümledir — borçlu olunan iş sarı, geciken kırmızı,
 * düz sayım gri; yeşil yalnızca istenen sonuca ulaşıldığında.
 */
export type SayiTonu = "ink" | "ok" | "warn" | "danger";

export function Stat({
  label, value, hint, tone = "ink", href,
}: {
  label: string; value: ReactNode; hint?: ReactNode; tone?: SayiTonu; href?: string;
}) {
  const valueTone =
    tone === "danger" ? "text-danger-700" : tone === "warn" ? "text-warn-700"
    : tone === "ok" ? "text-ok-700" : "text-ink-900";
  const body = (
    <>
      <p className="text-xs font-medium tracking-wide text-ink-500 uppercase">{label}</p>
      <p className={`tnum mt-1 text-xl leading-tight font-semibold break-words sm:text-2xl ${valueTone}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-500">{hint}</p>}
    </>
  );
  if (href) {
    return (
      <Link href={href} className="card block p-4 transition-colors hover:border-brand-300 hover:bg-brand-50/40">
        {body}
      </Link>
    );
  }
  return <div className="card p-4">{body}</div>;
}

/* --- Bildirim kutuları --------------------------------------------------- */

export function Notice({
  tone = "info", title, children,
}: {
  tone?: Tone; title?: ReactNode; children?: ReactNode;
}) {
  const cls: Record<Tone, string> = {
    ink: "border-ink-200 bg-ink-50 text-ink-700",
    info: "border-info-200 bg-info-50 text-ink-800",
    warn: "border-warn-200 bg-warn-50 text-ink-800",
    danger: "border-danger-200 bg-danger-50 text-ink-800",
    ok: "border-ok-200 bg-ok-50 text-ink-800",
    brand: "border-brand-200 bg-brand-50 text-ink-800",
  };
  return (
    <div className={`rounded-[6px] border px-3.5 py-3 text-sm ${cls[tone]}`} role="status">
      {title && <p className="mb-0.5 font-semibold">{title}</p>}
      {children}
    </div>
  );
}

/** Mevzuat dayanağını gösteren küçük not. */
export function Basis({ children }: { children: ReactNode }) {
  return (
    <p className="mt-1 text-xs text-ink-500">
      <span className="font-medium">Dayanak:</span> {children}
    </p>
  );
}

/* --- İlerleme çubuğu ----------------------------------------------------- */

export function ProgressSteps({
  steps, current,
}: {
  steps: { label: string; done?: boolean }[]; current: number;
}) {
  return (
    <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-2 text-xs">
      {steps.map((s, i) => {
        const n = i + 1;
        const state = s.done || n < current ? "done" : n === current ? "active" : "todo";
        return (
          <li key={s.label} className="flex items-center gap-1.5">
            <span
              className={
                "flex size-5 shrink-0 items-center justify-center rounded-full border text-rozet font-semibold " +
                (state === "done"
                  ? "border-ok-600 bg-ok-600 text-white"
                  : state === "active"
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-ink-300 bg-white text-ink-400")
              }
            >
              {state === "done" ? "✓" : n}
            </span>
            <span className={state === "todo" ? "text-ink-400" : "font-medium text-ink-700"}>
              {s.label}
            </span>
            {i < steps.length - 1 && <span className="mx-1 w-4 border-t border-ink-300" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}

/* --- Sekmeler ------------------------------------------------------------ */

export function Tabs({
  tabs, active, baseHref,
}: {
  tabs: { key: string; label: string; count?: number }[];
  active: string;
  baseHref: string;
}) {
  return (
    <nav className="-mb-px flex gap-0.5 overflow-x-auto border-b border-ink-200">
      {tabs.map((t) => {
        const on = t.key === active;
        const href = t.key === "ozet" ? baseHref : `${baseHref}?sekme=${t.key}`;
        return (
          <Link
            key={t.key}
            href={href}
            className={
              "flex shrink-0 items-center gap-1.5 border-b-2 px-3.5 py-2 text-sm font-medium transition-colors " +
              (on
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-ink-500 hover:border-ink-300 hover:text-ink-700")
            }
          >
            {t.label}
            {t.count != null && t.count > 0 && (
              <span className={`tnum rounded-full px-1.5 text-rozet ${on ? "bg-brand-100 text-brand-700" : "bg-ink-100 text-ink-600"}`}>
                {t.count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
