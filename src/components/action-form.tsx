"use client";

import { useActionState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import type { ActionResult } from "@/app/panel/actions";
import { Notice } from "./ui";

export type ServerAction = (prev: ActionResult, fd: FormData) => Promise<ActionResult>;

/**
 * Sunucu eylemlerini saran form. Hata ve başarı mesajını kendisi gösterir,
 * gönderim sırasında düğmeyi kilitler.
 */
export function ActionForm({
  action, children, submitLabel, submitTone = "primary", complaintId,
  confirm, className = "space-y-3", extra, compact = false, disabled = false,
}: {
  action: ServerAction;
  children?: ReactNode;
  submitLabel: string;
  submitTone?: "primary" | "secondary" | "danger";
  complaintId?: number;
  /** Gönderim öncesi onay sorusu. */
  confirm?: string;
  className?: string;
  /** Düğmenin yanına eklenecek içerik. */
  extra?: ReactNode;
  compact?: boolean;
  disabled?: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionResult, FormData>(action, {});
  const returnTo = useReturnTo();

  return (
    <form
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {complaintId != null && <input type="hidden" name="complaintId" value={complaintId} />}
      <input type="hidden" name="returnTo" value={returnTo} />
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      {state.ok && state.message && <Notice tone="ok">{state.message}</Notice>}
      {children}
      <div className={`flex flex-wrap items-center gap-2 ${compact ? "" : "pt-1"}`}>
        <button type="submit" disabled={pending || disabled}
                className={`btn btn-${submitTone} ${compact ? "btn-sm" : ""}`}>
          {pending ? "İşleniyor…" : submitLabel}
        </button>
        {extra}
      </div>
    </form>
  );
}

/** Tek düğmeli, alanı olmayan eylem (örnek: görevi tamamla). */
export function ActionButton({
  action, label, fields, tone = "secondary", confirm, complaintId, disabled,
}: {
  action: ServerAction;
  label: string;
  fields: Record<string, string | number>;
  tone?: "primary" | "secondary" | "danger";
  confirm?: string;
  complaintId?: number;
  disabled?: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionResult, FormData>(action, {});
  const returnTo = useReturnTo();
  return (
    <form action={formAction} className="inline"
          onSubmit={(e) => { if (confirm && !window.confirm(confirm)) e.preventDefault(); }}>
      {complaintId != null && <input type="hidden" name="complaintId" value={complaintId} />}
      <input type="hidden" name="returnTo" value={returnTo} />
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button type="submit" disabled={pending || disabled} className={`btn btn-${tone} btn-sm`}>
        {pending ? "…" : label}
      </button>
      {state.error && <span className="ml-2 text-xs text-danger-700">{state.error}</span>}
    </form>
  );
}

/** Eylem tamamlandıktan sonra geri dönülecek adres (sekme bilgisi korunur). */
function useReturnTo(): string {
  const path = usePathname();
  const search = useSearchParams();
  const params = new URLSearchParams(search.toString());
  params.delete("m");
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}
