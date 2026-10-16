"use client";

import { ActionForm } from "@/components/action-form";
import { Card, Notice } from "@/components/ui";
import {
  clearDataAction, generateDemoAction, holidayAction, settingsAction,
} from "@/app/panel/actions";

export interface SettingField {
  key: string;
  label: string;
  value: string;
  type: "text" | "number" | "bool" | "textarea";
  hint?: string;
}

export function SettingsForm({
  fields, gelismis = [],
}: {
  fields: SettingField[];
  /** Kurulumda bir kez girilip bir daha dokunulmayanlar; katlı durur. */
  gelismis?: SettingField[];
}) {
  const alan = (f: SettingField) => (
          <div key={f.key} className={f.type === "textarea" ? "sm:col-span-2" : undefined}>
            <label className="label" htmlFor={`ayar_${f.key}`}>{f.label}</label>
            {f.type === "bool" ? (
              <select id={`ayar_${f.key}`} name={`ayar_${f.key}`} defaultValue={f.value} className="input">
                <option value="1">Açık</option>
                <option value="0">Kapalı</option>
              </select>
            ) : f.type === "textarea" ? (
              <textarea id={`ayar_${f.key}`} name={`ayar_${f.key}`} rows={6}
                        defaultValue={f.value} className="input" />
            ) : (
              <input id={`ayar_${f.key}`} name={`ayar_${f.key}`}
                     type={f.type === "number" ? "number" : "text"}
                     defaultValue={f.value} className="input" />
            )}
            {f.hint && <span className="hint">{f.hint}</span>}
          </div>
  );

  return (
    <ActionForm action={settingsAction} submitLabel="Ayarları kaydet">
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">{fields.map(alan)}</div>

      {gelismis.length > 0 && (
        <details className="rounded-[5px] border border-ink-200 px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium text-ink-700">
            Gelişmiş ayarlar ({gelismis.length})
          </summary>
          <div className="mt-3 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            {gelismis.map(alan)}
          </div>
        </details>
      )}
    </ActionForm>
  );
}

export function HolidayForm() {
  return (
    <ActionForm action={holidayAction} submitLabel="Tatil ekle / güncelle" compact>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="hol-date">Tarih</label>
          <input id="hol-date" name="date" type="date" required className="input" />
        </div>
        <div className="min-w-56 flex-1">
          <label className="label" htmlFor="hol-name">Tatil adı</label>
          <input id="hol-name" name="name" className="input" placeholder="Ramazan Bayramı 1. Gün" />
        </div>
      </div>
    </ActionForm>
  );
}

export function HolidayDelete({ date, name }: { date: string; name: string }) {
  return (
    <ActionForm action={holidayAction} submitLabel="Sil" submitTone="secondary" compact
                className="inline" confirm={`${date} — ${name} kaydı silinecek. SLA hesapları değişir. Onaylıyor musunuz?`}>
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="sil" value="1" />
    </ActionForm>
  );
}

export function DemoDataForms({ complaintCount }: { complaintCount: number }) {
  return (
    <div className="space-y-5">
      <Card title="Örnek (demo) verisi üret">
        <ActionForm action={generateDemoAction} submitLabel="Demo verisi üret">
          {/*
            Uzun anlatım kaldırıldı: üretimin hangi fonksiyonlardan geçtiği
            geliştirici ayrıntısı. Kullanıcının bilmesi gereken tek şey
            kayıtların gerçek süreçten geçtiği ve bir kısmının açık kaldığı.
          */}
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-40">
              <label className="label" htmlFor="count">Şikâyet sayısı</label>
              <input id="count" name="count" type="number" min={1} max={120} defaultValue={48} className="input" />
            </div>
            <div className="w-40">
              <label className="label" htmlFor="months">Kaç aya yayılsın</label>
              <input id="months" name="months" type="number" min={1} max={24} defaultValue={9} className="input" />
            </div>
          </div>
          <p className="text-xs text-ink-500">
            Kayıtlar gerçek süreçten geçirilir; bir kısmı bilinçli olarak açık ve gecikmeli
            bırakılır. Mevcut {complaintCount} dosyaya eklenir, silme yapılmaz; 48 kayıt
            yaklaşık 10-20 saniye sürer.
          </p>
        </ActionForm>
      </Card>

      <Card title="Tüm şikâyet verisini sil">
        <ActionForm action={clearDataAction} submitLabel="Verileri sil" submitTone="danger"
                    confirm="Tüm şikâyet dosyaları, ekler ve bildirimler kalıcı olarak silinecek. Bu işlem geri alınamaz. Onaylıyor musunuz?">
          {/*
            Üç katmanlı onaydan ikisi kaldı: SIL yazmak ve tarayıcı onayı.
            Ayrıca bir de kırmızı kutu aynı uyarıyı üçüncü kez yazıyordu —
            yazdırılan uyarı sayısı arttıkça okunma olasılığı düşer.
          */}
          <div className="w-56">
            <label className="label" htmlFor="onay">
              {complaintCount} dosya ve tüm ekleri silinecek. Onaylamak için{" "}
              <code className="font-mono font-semibold">SIL</code> yazın
            </label>
            <input id="onay" name="onay" required className="input font-mono" autoComplete="off" />
          </div>
        </ActionForm>
      </Card>
    </div>
  );
}
