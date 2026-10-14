"use client";

import { DEMAND_LABEL, type Demand } from "@/lib/domain";
import { ActionForm } from "@/components/action-form";
import { Basis, Card, Notice } from "@/components/ui";
import {
  capaAction, cancelAction, closeAction, customerInfoAction, escalateAction,
  freightPaymentAction, inspectionAction, letterAction, transactionAction, tutanakAction,
} from "@/app/panel/actions";

export interface ActionCtx {
  complaintId: number;
  today: string;
  openTasks: string[];
  demand: string;
  demandsFreight: boolean;
  labRequired: boolean;
  quantityKg: number | null;
  verdict: string | null;
  hasApprovedTutanak: boolean;
  transactionDone: boolean;
  escalated: boolean;
  escalationRequired: boolean;
  escalationReason: string;
  letterSent: boolean;
  customerInformed: boolean;
  closed: boolean;
  recipients: string[];
  suggestedLetterNo: string;
  /**
   * Şu anda bu kullanıcının işleyebileceği adım kodları: açık + sırası gelmiş +
   * sorumlusu kendisi. Sunucu tarafı aynı kuralı requireTaskTurn ile yeniden
   * uygular; buradaki liste yalnızca neyin gösterileceğini belirler.
   */
  actionable: string[];
  /** Dosyayı iptal etme yetkisi (süreç adımı değil, yönetsel karar). */
  canCancel: boolean;
}

/** Sırası gelen ve sorumlusu bu kullanıcı olan adımların formlarını gösterir. */
export function IslemlerPanel({ ctx }: { ctx: ActionCtx }) {
  const has = (code: string) => ctx.actionable.includes(code);
  const cid = ctx.complaintId;
  const blocks: React.ReactNode[] = [];

  /* --- Yerinde inceleme --- */
  if (has("YERINDE_INCELEME")) {
    blocks.push(
      <Card key="inceleme" title="Yerinde inceleme sonucunu kaydet">
        <ActionForm action={inspectionAction} complaintId={cid} submitLabel="İncelemeyi kaydet">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="visitedAt">İnceleme tarihi</label>
              <input id="visitedAt" name="visitedAt" type="date" required
                     defaultValue={ctx.today} className="input" />
            </div>
            <div className="flex items-end">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" name="remoteOnly" value="1" />
                Yerinde gidilemedi, ürün görselleri üzerinden incelendi
              </label>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="note">İnceleme bulguları</label>
            <textarea id="note" name="note" rows={4} required className="input"
                      placeholder="Ekibin tespitleri, ürünün durumu, depolama koşulları, görüşülen kişiler…" />
          </div>
          <div className="rounded-[5px] border border-ink-200 bg-ink-50 p-3">
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input type="checkbox" name="labRequired" value="1" defaultChecked={ctx.labRequired}
                     className="mt-0.5" />
              <span>
                Laboratuvar analizi yapılacak
                <span className="block text-xs text-ink-500">
                  İşaretlenmezse numune ve analiz görevleri kapatılır, gerekçe tutanağa işlenir.
                </span>
              </span>
            </label>
            <div className="mt-2.5">
              <label className="label" htmlFor="labSkipReason">Analiz yapılmayacaksa gerekçesi</label>
              <input id="labSkipReason" name="labSkipReason" className="input"
                     placeholder="Örnek: Şikâyet ambalaj hasarına ilişkin olduğundan analiz gerekmemiştir." />
            </div>
          </div>
          <Basis>TL PASAT 004 md. 4 — analiz alınmayan durumlarda nedeni tutanakta belirtilir.</Basis>
        </ActionForm>
      </Card>,
    );
  }

  /* --- Tutanak ve karar --- */
  if (has("TUTANAK_HAZIRLA")) {
    blocks.push(
      <Card key="tutanak" title="İnceleme tutanağını düzenle ve kararı ver">
        <ActionForm action={tutanakAction} complaintId={cid}
                    submitLabel="Tutanağı düzenle ve imzaya gönder">
          <Notice tone="info">
            Düzenlenecek tutanak türü karara ve talebe göre otomatik belirlenir:{" "}
            <strong>haklı + nakliye bedeli talebi</strong> → FR PASAT 005,{" "}
            <strong>haklı + yalnızca iade/değişim</strong> → FR PASAT 004,{" "}
            <strong>haklı bulunmadı</strong> → İnceleme Tutanağı. Müşteri talebi:{" "}
            {DEMAND_LABEL[ctx.demand as Demand]}.
          </Notice>
          <div>
            <span className="label">Karar</span>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="flex cursor-pointer items-start gap-2 rounded-[5px] border border-ink-200 px-3 py-2 hover:bg-ink-50 has-checked:border-ok-200 has-checked:bg-ok-50">
                <input type="radio" name="verdict" value="HAKLI" required className="mt-0.5" />
                <span className="text-sm">
                  <strong>Şikâyet haklı</strong>
                  <span className="block text-xs text-ink-500">
                    Ürün ilgili kalite standartlarına ve/veya satış sözleşmesine uygun değil.
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2 rounded-[5px] border border-ink-200 px-3 py-2 hover:bg-ink-50 has-checked:border-ink-400 has-checked:bg-ink-100">
                <input type="radio" name="verdict" value="HAKSIZ" required className="mt-0.5" />
                <span className="text-sm">
                  <strong>Şikâyet haklı bulunmadı</strong>
                  <span className="block text-xs text-ink-500">
                    Ürün standartlara ve sözleşmeye uygun bulundu.
                  </span>
                </span>
              </label>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="verdictReason">İnceleme sonucu / gerekçe</label>
            <textarea id="verdictReason" name="verdictReason" rows={3} required className="input"
                      placeholder="Analiz sonuçları ve tespitlere dayanan gerekçe. Aylık raporlama tablosuna bu metin işlenir." />
          </div>
          <div>
            <label className="label" htmlFor="decision">Karar / yapılan işlem</label>
            <textarea id="decision" name="decision" rows={2} required className="input"
                      placeholder="Örnek: 60 ton ürünün iadesi ve geliş-gidiş nakliye bedelinin ödenmesi uygun görülmüştür." />
          </div>
          <div>
            <label className="label" htmlFor="bodyNote">Tutanağa eklenecek açıklama (isteğe bağlı)</label>
            <textarea id="bodyNote" name="bodyNote" rows={2} className="input" />
          </div>
          <Basis>TL PASAT 004 md. 4 — sonuç tutanak altına alınır, Fabrika Müdürü onayıyla kesinleşir.</Basis>
        </ActionForm>
      </Card>,
    );
  }

  /* --- İtiraz gönderimi --- */
  if (has("ITIRAZ_GONDER") && !ctx.escalated) {
    blocks.push(
      <Card key="itiraz" title="İtirazı Daire Başkanlığına gönder">
        <ActionForm action={escalateAction} complaintId={cid}
                    submitLabel="İtirazı gönder" submitTone="primary"
                    confirm="İtiraz ilgili Daire Başkanlığına gönderilecek. Onaylıyor musunuz?">
          <Notice tone="warn">{ctx.escalationReason}</Notice>
          <div>
            <label className="label" htmlFor="note">Üst yazı notu (isteğe bağlı)</label>
            <textarea id="note" name="note" rows={3} className="input"
                      placeholder="Daire Başkanlığına iletilecek ek açıklama." />
          </div>
          <Basis>TL PASAT 004 md. 5 — Daire Başkanlığı 5 iş günü içinde değerlendirip karar verir.</Basis>
        </ActionForm>
      </Card>,
    );
  }

  /* --- İade / değişim / nakliye --- */
  if (has("IADE_DEGISIM")) {
    const blocked = !ctx.hasApprovedTutanak;
    blocks.push(
      <Card key="islem" title="İade / değişim işlemini kaydet">
        {blocked && (
          <div className="mb-3">
            <Notice tone="warn">
              İşlem kaydı için tutanağın imza süreci tamamlanmış olmalıdır. Tutanaklar sekmesinden
              imza durumunu görebilirsiniz.
            </Notice>
          </div>
        )}
        <ActionForm action={transactionAction} complaintId={cid} disabled={blocked}
                    submitLabel="İşlemi kaydet">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="transactionDate">İşlem tarihi</label>
              <input id="transactionDate" name="transactionDate" type="date" required
                     defaultValue={ctx.today} className="input" />
              <span className="hint">Resmî yazı süresi (3 iş günü) bu tarihten başlar.</span>
            </div>
            <div>
              <label className="label" htmlFor="refundAmount">İade / mahsup bedeli (TL)</label>
              <input id="refundAmount" name="refundAmount" inputMode="decimal" className="input" />
            </div>
            <div>
              <label className="label" htmlFor="returnedKg">İade alınan miktar (kg)</label>
              <input id="returnedKg" name="returnedKg" inputMode="decimal" className="input"
                     defaultValue={ctx.quantityKg ?? ""} />
            </div>
            <div>
              <label className="label" htmlFor="exchangedKg">Değişimi yapılan miktar (kg)</label>
              <input id="exchangedKg" name="exchangedKg" inputMode="decimal" className="input" />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="note">Açıklama</label>
            <textarea id="note" name="note" rows={2} className="input"
                      placeholder="İrsaliye no, teslim alan kişi, ödeme referansı…" />
          </div>
          <Basis>TL PASAT 004 md. 6 — şikâyet tarihinden itibaren 5 iş günü içinde tamamlanmalıdır.</Basis>
        </ActionForm>
      </Card>,
    );
  }

  /* --- Nakliye bedelinin ödenmesi (Muhasebe adımı, md. 6-b) --- */
  if (has("NAKLIYE_ODEME")) {
    blocks.push(
      <Card key="nakliye" title="Nakliye bedeli ödemesini kaydet">
        <ActionForm action={freightPaymentAction} complaintId={cid}
                    submitLabel="Ödemeyi kaydet">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="amount">Ödenen tutar (TL)</label>
              <input id="amount" name="amount" inputMode="decimal" required className="input" />
            </div>
            <div>
              <label className="label" htmlFor="paidAt">Ödeme tarihi</label>
              <input id="paidAt" name="paidAt" type="date" required defaultValue={ctx.today}
                     className="input" />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="note">Açıklama</label>
            <textarea id="note" name="note" rows={2} className="input"
                      placeholder="Ödeme referansı, banka, dekont no…" />
          </div>
          <Basis>
            TL PASAT 004 md. 6-b — kusur fabrikadan kaynaklandığından firmanın geliş-gidiş
            nakliye masrafları ödenir. Ödeme Muhasebe tarafından kaydedilir.
          </Basis>
        </ActionForm>
      </Card>,
    );
  }

  /* --- Düzeltici faaliyet --- */
  if (has("CAPA_BASLAT")) {
    blocks.push(
      <Card key="capa" title="FSSC 22000 düzeltici faaliyeti başlat">
        <ActionForm action={capaAction} complaintId={cid} submitLabel="Düzeltici faaliyeti kaydet">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="capaNo">DF numarası</label>
              <input id="capaNo" name="capaNo" required className="input" placeholder="DF-2026-014" />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="note">Planlanan faaliyet</label>
              <input id="note" name="note" required className="input"
                     placeholder="Örnek: Paketleme hattı nem kontrolü sıklığı artırıldı." />
            </div>
          </div>
          <Basis>
            TL PASAT 004 md. 4 — tutanaklar Fabrika Müdürünün onayından sonra Gıda Güvenliği Ekibi
            gerekli düzeltici faaliyeti başlatır.
          </Basis>
        </ActionForm>
      </Card>,
    );
  }

  /* --- Resmî yazı --- */
  if (has("RESMI_YAZI")) {
    blocks.push(
      <Card key="yazi" title="Resmî yazıyı Daire Başkanlıklarına gönder">
        <ActionForm action={letterAction} complaintId={cid} submitLabel="Gönderimi kaydet">
          <Notice tone="info" title="Gönderilecek daireler">
            <ul className="mt-1 list-inside list-disc">
              {ctx.recipients.map((r) => <li key={r}>{r}</li>)}
            </ul>
            <p className="mt-1.5 text-xs">
              Ekler: Müşteri Şikâyet Formu, analiz raporları, tutanaklar ve yapılan işlemlerin
              sonucu (PDF).
            </p>
          </Notice>
          <div>
            <label className="label" htmlFor="letterNo">Resmî yazı sayısı</label>
            <input id="letterNo" name="letterNo" required className="input"
                   defaultValue={ctx.suggestedLetterNo} />
          </div>
          <div>
            <label className="label" htmlFor="note">Not</label>
            <textarea id="note" name="note" rows={2} className="input" />
          </div>
          <Basis>TL PASAT 004 md. 6 — işlem tarihinden itibaren 3 iş günü içinde iletilir.</Basis>
        </ActionForm>
      </Card>,
    );
  }

  /* --- Müşteri bilgilendirme --- */
  if (has("MUSTERI_BILGI")) {
    blocks.push(
      <Card key="bilgi" title="Müşteri Bilgilendirme Formunu düzenle">
        <ActionForm action={customerInfoAction} complaintId={cid}
                    submitLabel="Formu düzenle ve müşteriye gönder">
          <div>
            <label className="label" htmlFor="explanation">Açıklama (müşteriye iletilecek metin)</label>
            <textarea id="explanation" name="explanation" rows={5} required className="input"
                      placeholder="Yapılan inceleme, analiz sonucu, alınan karar ve gerçekleştirilen işlemleri müşteriye anlatan metin." />
          </div>
          <Basis>
            TL PASAT 004 md. 7 — fabrika tarafından yapılan işlemler Müşteri Bilgilendirme Formunun
            açıklama kısmına yazılarak müşteriye gönderilir.
          </Basis>
        </ActionForm>
      </Card>,
    );
  }

  /* --- Kapanış --- */
  if (has("DOSYA_KAPAT")) {
    const otherOpen = ctx.openTasks.filter((t) => t !== "DOSYA_KAPAT");
    blocks.push(
      <Card key="kapat" title="Dosyayı kapat">
        {otherOpen.length > 0 && (
          <div className="mb-3">
            <Notice tone="warn">
              Dosyayı kapatmadan önce {otherOpen.length} görev daha tamamlanmalıdır.
            </Notice>
          </div>
        )}
        <ActionForm action={closeAction} complaintId={cid} disabled={otherOpen.length > 0}
                    submitLabel="Dosyayı kapat"
                    confirm="Dosya kapatılacak ve müşteriye kapanış bildirimi gönderilecek. Onaylıyor musunuz?">
          <div>
            <label className="label" htmlFor="note">Kapanış notu</label>
            <textarea id="note" name="note" rows={3} required className="input"
                      placeholder="Dosyanın özeti ve kapanış gerekçesi. Aylık raporlamaya işlenir." />
          </div>
          <Basis>TL PASAT 004 md. 8 — kapanan dosyalar aylık tabloya işlenerek raporlanır.</Basis>
        </ActionForm>
      </Card>,
    );
  }

  return (
    <div className="space-y-5">
      {blocks.length === 0 ? (
        <Notice tone="ink" title="Şu anda size düşen bir işlem yok">
          {ctx.closed
            ? "Dosya kapatılmıştır."
            : "Dosyanın sıradaki adımı başka bir unvanın sorumluluğunda. Görev listesinden kimde beklediğini görebilirsiniz."}
        </Notice>
      ) : (
        blocks
      )}

      {!ctx.closed && ctx.canCancel && (
        <Card title="Dosyayı iptal et">
          <ActionForm action={cancelAction} complaintId={cid} submitLabel="Dosyayı iptal et"
                      submitTone="danger"
                      confirm="Dosya iptal edilecek ve tüm açık görevler kapatılacak. Bu işlem geri alınamaz. Onaylıyor musunuz?">
            <Notice tone="danger">
              İptal yalnızca mükerrer kayıt, yanlış kayıt veya müşterinin başvurusunu geri çekmesi
              gibi hallerde kullanılır. Şikâyetin haklı bulunmaması bir iptal sebebi değildir.
            </Notice>
            <div>
              <label className="label" htmlFor="reason">İptal gerekçesi</label>
              <textarea id="reason" name="reason" rows={2} required className="input" />
            </div>
          </ActionForm>
        </Card>
      )}
    </div>
  );
}
