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

export function SettingsForm({ fields }: { fields: SettingField[] }) {
  return (
    <ActionForm action={settingsAction} submitLabel="Ayarları kaydet">
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        {fields.map((f) => (
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
        ))}
      </div>
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
          <Notice tone="info">
            Üretilen kayıtlar gerçek iş kuralları motorundan geçer: ekip oluşturma, numune, analiz,
            6 adımlı tutanak imza zinciri, itiraz, iade/değişim, resmî yazı ve kapanış adımları
            gerçek süreç fonksiyonlarıyla yürütülür. Sonrasında zaman damgaları geçmişe yayılmış
            gerçekçi bir takvime yazılır, böylece SLA ve trend raporları anlamlı görünür.
            Dosyaların bir kısmı bilinçli olarak açık ve gecikmeli bırakılır.
          </Notice>
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
            Mevcut {complaintCount} dosyaya ekleme yapılır; silme yapılmaz. 48 kayıt yaklaşık
            10-20 saniye sürer.
          </p>
        </ActionForm>
      </Card>

      <Card title="Tüm şikâyet verisini sil">
        <ActionForm action={clearDataAction} submitLabel="Verileri sil" submitTone="danger"
                    confirm="Tüm şikâyet dosyaları, tutanaklar, analizler ve bildirimler kalıcı olarak silinecek. Bu işlem geri alınamaz. Onaylıyor musunuz?">
          <Notice tone="danger" title="Bu işlem geri alınamaz">
            {complaintCount} şikâyet dosyası ve bunlara bağlı tüm görevler, tutanaklar, imzalar,
            numuneler, analizler, ekler ve bildirimler silinir. Fabrika, ürün, kategori, resmî
            tatil tanımları ve kullanıcı hesapları korunur.
          </Notice>
          <div className="w-56">
            <label className="label" htmlFor="onay">
              Onaylamak için <code className="font-mono font-semibold">SIL</code> yazın
            </label>
            <input id="onay" name="onay" required className="input font-mono" autoComplete="off" />
          </div>
        </ActionForm>
      </Card>
    </div>
  );
}
