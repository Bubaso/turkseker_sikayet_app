"use client";

import { ASAMA } from "@/lib/asamalar";
import { ActionForm } from "@/components/action-form";
import { Basis } from "@/components/ui";
import { asamaAction } from "@/app/panel/actions";

/**
 * Daire Başkanlığı itiraz kararı. Karar yazısı dairede hazırlanıp imzalanır;
 * buraya kararın kendisi ve imzalı yazının nüshası yüklenir.
 */
export function EscalationDecision({
  complaintId, bugun, accept,
}: {
  complaintId: number;
  bugun: string;
  accept: string;
}) {
  return (
    <ActionForm action={asamaAction} complaintId={complaintId}
                submitLabel="Kararı kaydet"
                confirm="İtiraz kararı kaydedilecek ve müşteriye bildirim gönderilecek. Onaylıyor musunuz?">
      <input type="hidden" name="asama" value={ASAMA.DAIRE_KARAR} />

      <div>
        <span className="label">Daire kararı</span>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="flex cursor-pointer items-start gap-2 rounded-[5px] border border-ink-200 px-3 py-2 hover:bg-ink-50 has-checked:border-ok-200 has-checked:bg-ok-50">
            <input type="radio" name="itirazKabul" value="1" required className="mt-0.5" />
            <span className="text-sm">
              <strong>İtiraz kabul — şikâyet haklı</strong>
              <span className="block text-xs text-ink-500">
                Dosya iade/değişim sürecine döner; 5 iş günlük süre bu tarihten başlar.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 rounded-[5px] border border-ink-200 px-3 py-2 hover:bg-ink-50 has-checked:border-ink-400 has-checked:bg-ink-100">
            <input type="radio" name="itirazKabul" value="0" required className="mt-0.5" />
            <span className="text-sm">
              <strong>İtiraz reddi — fabrika kararı teyit</strong>
              <span className="block text-xs text-ink-500">
                Dosya müşteriye yazılı bildirim ve kapanışa ilerler.
              </span>
            </span>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[11rem_1fr]">
        <div>
          <label className="label" htmlFor={`tarih-${complaintId}`}>Karar tarihi</label>
          <input id={`tarih-${complaintId}`} name="tarih" type="date" className="input"
                 defaultValue={bugun} max={bugun} required />
        </div>
        <div>
          <label className="label" htmlFor={`not-${complaintId}`}>Karar gerekçesi</label>
          <input id={`not-${complaintId}`} name="not" className="input" required
                 placeholder="Tutanak, analiz sonuçları ve sözleşme hükümleri çerçevesinde kararın dayanağı." />
        </div>
      </div>

      <div>
        <label className="label" htmlFor={`belge-${complaintId}`}>
          Daire Başkanlığı karar yazısı
        </label>
        <input id={`belge-${complaintId}`} name="belge" type="file" multiple required accept={accept}
               className="input file:mr-3 file:rounded file:border-0 file:bg-ink-100 file:px-3 file:py-1.5 file:text-sm" />
        <span className="hint">
          Yazı dairede hazırlanıp imzalanır; buraya yalnızca imzalı nüshası yüklenir.
        </span>
      </div>

      <Basis>
        TL PASAT 004 md. 5 — ilgili Daire Başkanlığı, itirazın yapıldığı tarihten itibaren 5 iş günü
        içinde itirazı değerlendirir ve karar verir.
      </Basis>
    </ActionForm>
  );
}
