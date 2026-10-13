"use client";

import { CHANNEL, CHANNEL_LABEL, DEMAND_LABEL, PRODUCT_GROUP_LABEL, type Channel, type Demand } from "@/lib/domain";
import { ActionForm } from "@/components/action-form";
import { Basis, Card, Notice } from "@/components/ui";
import { staffComplaintAction } from "@/app/panel/actions";

export interface StaffFormRefs {
  factories: { id: number; name: string }[];
  products: { id: number; name: string; product_group: string; packaging: string | null }[];
  categories: { id: number; name: string; family: string }[];
  provinces: { code: string; name: string }[];
  familyLabels: Record<string, string>;
  ownFactoryId: number;
  today: string;
  accept: string;
}

/** Telefon / e-posta / dilekçe ile gelen şikâyetlerin personel tarafından kaydı. */
export default function StaffComplaintForm({ refs }: { refs: StaffFormRefs }) {
  const byGroup = new Map<string, typeof refs.products>();
  for (const p of refs.products) {
    const a = byGroup.get(p.product_group) ?? [];
    a.push(p);
    byGroup.set(p.product_group, a);
  }
  const byFamily = new Map<string, typeof refs.categories>();
  for (const c of refs.categories) {
    const a = byFamily.get(c.family) ?? [];
    a.push(c);
    byFamily.set(c.family, a);
  }

  return (
    <ActionForm action={staffComplaintAction} submitLabel="Şikâyeti kaydet" className="space-y-5">
      <Notice tone="info">
        Çevrim içi formdan gelmeyen başvurular burada kaydedilir. Kayıt açıldığı anda Müşteri
        Şikâyet Formu (FR PASAT 007) düzenlenir, görev kartları açılır ve SLA süreleri şikâyet
        tarihinden itibaren işlemeye başlar.
      </Notice>

      <Card title="Başvuru bilgisi">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="channel">Başvuru kanalı</label>
            <select id="channel" name="channel" className="input" defaultValue={CHANNEL.TELEFON}>
              {(Object.keys(CHANNEL_LABEL) as Channel[]).map((c) => (
                <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="received_at">Şikâyet tarihi</label>
            <input id="received_at" name="received_at" type="date" required
                   defaultValue={refs.today} max={refs.today} className="input" />
            <span className="hint">SLA süreleri bu tarihten başlar.</span>
          </div>
          <div>
            <label className="label" htmlFor="origin_factory_id">Üretici fabrika</label>
            <select id="origin_factory_id" name="origin_factory_id" className="input"
                    defaultValue={String(refs.ownFactoryId)}>
              {refs.factories.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
        </div>
      </Card>

      <Card title="Şikâyet sahibi">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="customer_company">
              Firma adı / Ad soyad <span className="text-danger-600">*</span>
            </label>
            <input id="customer_company" name="customer_company" required className="input" />
          </div>
          <div>
            <label className="label" htmlFor="customer_name">Yetkili adı soyadı</label>
            <input id="customer_name" name="customer_name" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="customer_title">Unvanı</label>
            <input id="customer_title" name="customer_title" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="customer_phone">
              Cep telefonu <span className="text-danger-600">*</span>
            </label>
            <input id="customer_phone" name="customer_phone" type="tel" required className="input"
                   placeholder="0532 123 45 67" />
            <span className="hint">Bilgilendirme SMS'leri bu numaraya gider.</span>
          </div>
          <div>
            <label className="label" htmlFor="customer_email">E-posta</label>
            <input id="customer_email" name="customer_email" type="email" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="customer_province">İl</label>
            <select id="customer_province" name="customer_province" className="input">
              <option value="">Seçiniz…</option>
              {refs.provinces.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
            </select>
            <span className="hint">Daha yakın fabrika önerisi için kullanılır.</span>
          </div>
          <div>
            <label className="label" htmlFor="customer_tax_no">Vergi no / TC kimlik no</label>
            <input id="customer_tax_no" name="customer_tax_no" className="input" inputMode="numeric" />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="customer_address">Adres</label>
            <textarea id="customer_address" name="customer_address" rows={2} className="input" />
          </div>
        </div>
      </Card>

      <Card title="Ürün bilgisi">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="product_id">
              Ürün <span className="text-danger-600">*</span>
            </label>
            <select id="product_id" name="product_id" required className="input">
              <option value="">Seçiniz…</option>
              {[...byGroup.entries()].map(([g, items]) => (
                <optgroup key={g} label={PRODUCT_GROUP_LABEL[g as keyof typeof PRODUCT_GROUP_LABEL] ?? g}>
                  {items.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}{p.packaging ? ` — ${p.packaging}` : ""}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="lot_no">Parti / Lot no</label>
            <input id="lot_no" name="lot_no" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="quantity_kg">Şikâyete konu miktar (kg)</label>
            <input id="quantity_kg" name="quantity_kg" inputMode="decimal" className="input" />
            <span className="hint">İtiraz eşiği bu miktara göre hesaplanır.</span>
          </div>
          <div>
            <label className="label" htmlFor="invoice_no">Fatura no</label>
            <input id="invoice_no" name="invoice_no" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="delivery_note_no">İrsaliye no</label>
            <input id="delivery_note_no" name="delivery_note_no" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="contract_no">Sözleşme no</label>
            <input id="contract_no" name="contract_no" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="delivery_date">Teslim tarihi</label>
            <input id="delivery_date" name="delivery_date" type="date" className="input" />
          </div>
        </div>
      </Card>

      <Card title="Şikâyet">
        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className="label" htmlFor="category_id">Şikâyet türü</label>
            <select id="category_id" name="category_id" className="input">
              <option value="">Seçiniz…</option>
              {[...byFamily.entries()].map(([f, items]) => (
                <optgroup key={f} label={refs.familyLabels[f] ?? f}>
                  {items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </optgroup>
              ))}
            </select>
            <span className="hint">
              Gıda güvenliği türleri kritik olarak işaretlenir ve laboratuvar analizi varsayılan
              olarak gerekli sayılır.
            </span>
          </div>
          <div>
            <label className="label" htmlFor="subject">
              Şikâyet konusu <span className="text-danger-600">*</span>
            </label>
            <input id="subject" name="subject" required maxLength={200} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="description">Ayrıntılı açıklama</label>
            <textarea id="description" name="description" rows={4} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="demand">
              Şikâyetçi talebi <span className="text-danger-600">*</span>
            </label>
            <select id="demand" name="demand" required className="input" defaultValue="IADE">
              {(Object.keys(DEMAND_LABEL) as Demand[]).map((d) => (
                <option key={d} value={d}>{DEMAND_LABEL[d]}</option>
              ))}
            </select>
            <span className="hint">
              Nakliye bedeli içeren talepler FR PASAT 005, diğerleri FR PASAT 004 tutanağı gerektirir.
            </span>
          </div>
          <div>
            <label className="label" htmlFor="kanit">Kanıt dosyaları</label>
            <input id="kanit" name="kanit" type="file" multiple accept={refs.accept}
                   className="input file:mr-3 file:rounded file:border-0 file:bg-ink-100 file:px-3 file:py-1.5 file:text-sm" />
          </div>
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input type="checkbox" name="kvkk" value="1" className="mt-0.5" defaultChecked />
            <span>
              Başvuru sahibine KVKK aydınlatma metni hakkında bilgi verildi.
            </span>
          </label>
        </div>
        <Basis>
          TL PASAT 004 md. 1 — fabrika, müşteri şikâyetinin alınması akabinde ISO 9001:2015 Kalite
          Yönetim Sistemi kapsamında Müşteri Şikâyet Formunu doldurur.
        </Basis>
      </Card>
    </ActionForm>
  );
}
