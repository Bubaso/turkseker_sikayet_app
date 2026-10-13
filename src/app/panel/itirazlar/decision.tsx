"use client";

import { ActionForm } from "@/components/action-form";
import { Basis } from "@/components/ui";
import { escalationDecisionAction } from "@/app/panel/actions";

/** Daire Başkanlığı itiraz kararı formu. */
export function EscalationDecision({ complaintId }: { complaintId: number }) {
  return (
    <ActionForm action={escalationDecisionAction} complaintId={complaintId}
                submitLabel="Kararı kaydet"
                confirm="İtiraz kararı kaydedilecek ve müşteriye bildirim gönderilecek. Onaylıyor musunuz?">
      <div>
        <span className="label">Daire kararı</span>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="flex cursor-pointer items-start gap-2 rounded-[5px] border border-ink-200 px-3 py-2 hover:bg-ink-50 has-checked:border-ok-200 has-checked:bg-ok-50">
            <input type="radio" name="result" value="SIKAYET_HAKLI" required className="mt-0.5" />
            <span className="text-sm">
              <strong>İtiraz kabul — şikâyet haklı</strong>
              <span className="block text-xs text-ink-500">
                Dosya iade/değişim sürecine döner, fabrikada işlem görevleri açılır.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 rounded-[5px] border border-ink-200 px-3 py-2 hover:bg-ink-50 has-checked:border-ink-400 has-checked:bg-ink-100">
            <input type="radio" name="result" value="SIKAYET_HAKSIZ" required className="mt-0.5" />
            <span className="text-sm">
              <strong>İtiraz reddi — fabrika kararı teyit</strong>
              <span className="block text-xs text-ink-500">
                Dosya müşteri bilgilendirmesi ve kapanışa ilerler.
              </span>
            </span>
          </label>
        </div>
      </div>
      <div>
        <label className="label" htmlFor={`note-${complaintId}`}>Karar gerekçesi</label>
        <textarea id={`note-${complaintId}`} name="note" rows={3} required className="input"
                  placeholder="Tutanak, analiz sonuçları ve satış sözleşmesi hükümleri çerçevesinde kararın dayanağı." />
      </div>
      <Basis>
        TL PASAT 004 md. 5 — ilgili Daire Başkanlığı, itirazın yapıldığı tarihten itibaren 5 iş günü
        içinde itirazı değerlendirir ve karar verir.
      </Basis>
    </ActionForm>
  );
}
