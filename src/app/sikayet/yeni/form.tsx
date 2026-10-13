"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import {
  CHANNEL_LABEL, DEMAND, DEMAND_LABEL, PRODUCT_GROUP_LABEL, type Demand,
} from "@/lib/domain";
import { fmtPhone, isValidEmail, isValidPhone } from "@/lib/format";
import { Notice, ProgressSteps } from "@/components/ui";
import { sendOtpAction, submitComplaintAction, type SubmitState } from "../actions";

export interface FormRefs {
  factories: { id: number; name: string; province: string }[];
  products: { id: number; name: string; product_group: string; packaging: string | null }[];
  categories: { id: number; name: string; family: string }[];
  provinces: { code: string; name: string }[];
  familyLabels: Record<string, string>;
  kvkkText: string;
  otpRequired: boolean;
  maxFiles: number;
  maxMb: number;
  accept: string;
}

const STEPS = ["Başvuru sahibi", "Ürün bilgisi", "Şikâyet", "Onay ve gönderim"];

export default function ComplaintForm({ refs }: { refs: FormRefs }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Adım 1-3 alanları — özet ekranı ve doğrulama için izlenir.
  const [v, setV] = useState({
    customer_company: "", customer_name: "", customer_title: "",
    customer_province: "", customer_address: "", customer_phone: "",
    customer_email: "", customer_tax_no: "",
    origin_factory_id: "", product_id: "", lot_no: "", quantity_kg: "",
    invoice_no: "", delivery_note_no: "", contract_no: "", delivery_date: "",
    category_id: "", subject: "", description: "", demand: DEMAND.IADE as string,
  });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setV((p) => ({ ...p, [k]: e.target.value }));

  const [fileNames, setFileNames] = useState<string[]>([]);
  const [kvkk, setKvkk] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpInfo, setOtpInfo] = useState<string | null>(null);
  const [otpSending, setOtpSending] = useState(false);

  const productsByGroup = useMemo(() => {
    const m = new Map<string, typeof refs.products>();
    for (const p of refs.products) {
      const a = m.get(p.product_group) ?? [];
      a.push(p);
      m.set(p.product_group, a);
    }
    return [...m.entries()];
  }, [refs.products]);

  const categoriesByFamily = useMemo(() => {
    const m = new Map<string, typeof refs.categories>();
    for (const c of refs.categories) {
      const a = m.get(c.family) ?? [];
      a.push(c);
      m.set(c.family, a);
    }
    return [...m.entries()];
  }, [refs.categories]);

  const selectedProduct = refs.products.find((p) => String(p.id) === v.product_id);
  const selectedFactory = refs.factories.find((f) => String(f.id) === v.origin_factory_id);
  const selectedCategory = refs.categories.find((c) => String(c.id) === v.category_id);

  /* --- Adım doğrulama --------------------------------------------------- */

  function validateStep(n: number): boolean {
    const e: Record<string, string> = {};
    if (n === 1) {
      if (!v.customer_company.trim()) e.customer_company = "Firma veya kişi adı zorunludur.";
      if (!v.customer_province) e.customer_province = "İl seçiniz.";
      if (!isValidPhone(v.customer_phone)) e.customer_phone = "Geçerli bir cep telefonu giriniz (0532 123 45 67).";
      if (v.customer_email && !isValidEmail(v.customer_email)) e.customer_email = "Geçerli bir e-posta adresi giriniz.";
    }
    if (n === 2) {
      if (!v.origin_factory_id) e.origin_factory_id = "Ürünü aldığınız fabrikayı seçiniz.";
      if (!v.product_id) e.product_id = "Ürün seçiniz.";
      if (v.quantity_kg && !Number.isFinite(Number(v.quantity_kg.replace(",", ".")))) {
        e.quantity_kg = "Miktarı sayı olarak giriniz.";
      }
    }
    if (n === 3) {
      if (!v.subject.trim()) e.subject = "Şikâyet konusunu kısaca yazınız.";
      if (v.subject.trim().length < 5) e.subject = "Şikâyet konusu en az 5 karakter olmalıdır.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function next() {
    if (!validateStep(step)) {
      setBanner("Lütfen işaretli alanları düzeltiniz.");
      return;
    }
    setBanner(null);
    setStep((s) => Math.min(4, s + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function back() {
    setBanner(null);
    setErrors({});
    setStep((s) => Math.max(1, s - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* --- Doğrulama kodu --------------------------------------------------- */

  async function handleSendOtp() {
    setOtpSending(true);
    setOtpInfo(null);
    const res = await sendOtpAction(v.customer_phone);
    setOtpSending(false);
    if (!res.sent) {
      setErrors((p) => ({ ...p, otp_code: res.error ?? "Kod gönderilemedi." }));
      return;
    }
    setOtpSent(true);
    setErrors((p) => ({ ...p, otp_code: "" }));
    setOtpInfo(
      res.demoCode
        ? `Demo modu: SMS gerçekten gönderilmedi. Doğrulama kodunuz ${res.demoCode}`
        : `${fmtPhone(v.customer_phone)} numarasına 6 haneli kod gönderildi. Kod ${res.minutes ?? 10} dakika geçerlidir.`,
    );
  }

  /* --- Gönderim --------------------------------------------------------- */

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const local: Record<string, string> = {};
    if (!kvkk) local.kvkk = "Aydınlatma metnini onaylamanız gerekir.";
    if (refs.otpRequired && !otp.trim()) local.otp_code = "Doğrulama kodunu giriniz.";
    if (Object.keys(local).length) {
      setErrors(local);
      setBanner("Gönderim için eksik alanlar var.");
      return;
    }
    setBanner(null);
    startTransition(async () => {
      const res: SubmitState = await submitComplaintAction(fd);
      if (res.ok && res.complaintNo) {
        router.push(`/sikayet/tesekkur/${encodeURIComponent(res.complaintNo)}?t=${res.trackingToken ?? ""}`);
        return;
      }
      setErrors(res.fieldErrors ?? {});
      setBanner(res.error ?? "Kayıt oluşturulamadı.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  const Err = ({ k }: { k: string }) => (errors[k] ? <span className="err">{errors[k]}</span> : null);
  const cls = (k: string) => `input ${errors[k] ? "input-err" : ""}`;

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-5">
      <div className="card-pad">
        <ProgressSteps steps={STEPS.map((label) => ({ label }))} current={step} />
      </div>

      {banner && <Notice tone="danger" title="Form gönderilemedi">{banner}</Notice>}

      {/* ---------------- Adım 1: Başvuru sahibi ---------------- */}
      <fieldset className={step === 1 ? "card" : "hidden"}>
        <legend className="sr-only">Başvuru sahibi bilgileri</legend>
        <h2 className="card-title">1. Başvuru sahibi</h2>
        <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-5">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="customer_company">
              Firma adı / Ad soyad <span className="text-danger-600">*</span>
            </label>
            <input id="customer_company" name="customer_company" className={cls("customer_company")}
                   value={v.customer_company} onChange={set("customer_company")}
                   placeholder="Örnek: Ak Gıda San. Tic. Ltd. Şti." autoComplete="organization" />
            <Err k="customer_company" />
          </div>

          <div>
            <label className="label" htmlFor="customer_name">Yetkili adı soyadı</label>
            <input id="customer_name" name="customer_name" className="input"
                   value={v.customer_name} onChange={set("customer_name")} autoComplete="name" />
          </div>
          <div>
            <label className="label" htmlFor="customer_title">Unvanı</label>
            <input id="customer_title" name="customer_title" className="input"
                   value={v.customer_title} onChange={set("customer_title")}
                   placeholder="Örnek: Satın Alma Müdürü" />
          </div>

          <div>
            <label className="label" htmlFor="customer_phone">
              Cep telefonu <span className="text-danger-600">*</span>
            </label>
            <input id="customer_phone" name="customer_phone" type="tel" inputMode="tel"
                   className={cls("customer_phone")} value={v.customer_phone}
                   onChange={set("customer_phone")} placeholder="0532 123 45 67" autoComplete="tel" />
            <span className="hint">Şikâyetinizle ilgili bilgilendirmeler bu numaraya SMS ile gönderilir.</span>
            <Err k="customer_phone" />
          </div>
          <div>
            <label className="label" htmlFor="customer_email">E-posta</label>
            <input id="customer_email" name="customer_email" type="email" className={cls("customer_email")}
                   value={v.customer_email} onChange={set("customer_email")}
                   placeholder="ornek@firma.com.tr" autoComplete="email" />
            <span className="hint">Tutanak ve bilgilendirme formu e-posta ile iletilir.</span>
            <Err k="customer_email" />
          </div>

          <div>
            <label className="label" htmlFor="customer_province">
              İl <span className="text-danger-600">*</span>
            </label>
            <select id="customer_province" name="customer_province" className={cls("customer_province")}
                    value={v.customer_province} onChange={set("customer_province")}>
              <option value="">Seçiniz…</option>
              {refs.provinces.map((p) => (
                <option key={p.code} value={p.code}>{p.name}</option>
              ))}
            </select>
            <span className="hint">İnceleme ekibi en yakın fabrikamızdan görevlendirilebilir.</span>
            <Err k="customer_province" />
          </div>
          <div>
            <label className="label" htmlFor="customer_tax_no">Vergi no / TC kimlik no</label>
            <input id="customer_tax_no" name="customer_tax_no" className="input" inputMode="numeric"
                   value={v.customer_tax_no} onChange={set("customer_tax_no")} />
          </div>

          <div className="sm:col-span-2">
            <label className="label" htmlFor="customer_address">Adres</label>
            <textarea id="customer_address" name="customer_address" rows={2} className="input"
                      value={v.customer_address} onChange={set("customer_address")}
                      placeholder="Ürünün bulunduğu depo / işletme adresi" />
          </div>
        </div>
      </fieldset>

      {/* ---------------- Adım 2: Ürün bilgisi ---------------- */}
      <fieldset className={step === 2 ? "card" : "hidden"}>
        <legend className="sr-only">Ürün bilgileri</legend>
        <h2 className="card-title">2. Ürün bilgisi</h2>
        <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-5">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="origin_factory_id">
              Ürünü aldığınız şeker fabrikası <span className="text-danger-600">*</span>
            </label>
            <select id="origin_factory_id" name="origin_factory_id" className={cls("origin_factory_id")}
                    value={v.origin_factory_id} onChange={set("origin_factory_id")}>
              <option value="">Seçiniz…</option>
              {refs.factories.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
            <span className="hint">
              Bilmiyorsanız faturanızda yazan fabrikayı seçiniz; gerekirse dosya doğru fabrikaya yönlendirilir.
            </span>
            <Err k="origin_factory_id" />
          </div>

          <div className="sm:col-span-2">
            <label className="label" htmlFor="product_id">
              Ürün <span className="text-danger-600">*</span>
            </label>
            <select id="product_id" name="product_id" className={cls("product_id")}
                    value={v.product_id} onChange={set("product_id")}>
              <option value="">Seçiniz…</option>
              {productsByGroup.map(([group, items]) => (
                <optgroup key={group} label={PRODUCT_GROUP_LABEL[group as keyof typeof PRODUCT_GROUP_LABEL] ?? group}>
                  {items.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}{p.packaging ? ` — ${p.packaging}` : ""}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <Err k="product_id" />
          </div>

          <div>
            <label className="label" htmlFor="lot_no">Parti / Lot numarası</label>
            <input id="lot_no" name="lot_no" className="input" value={v.lot_no} onChange={set("lot_no")}
                   placeholder="Ambalaj üzerinde yazar" />
          </div>
          <div>
            <label className="label" htmlFor="quantity_kg">Şikâyete konu miktar (kg)</label>
            <input id="quantity_kg" name="quantity_kg" inputMode="decimal" className={cls("quantity_kg")}
                   value={v.quantity_kg} onChange={set("quantity_kg")} placeholder="Örnek: 25000" />
            <span className="hint">1 ton = 1.000 kg</span>
            <Err k="quantity_kg" />
          </div>

          <div>
            <label className="label" htmlFor="invoice_no">Fatura numarası</label>
            <input id="invoice_no" name="invoice_no" className="input" value={v.invoice_no} onChange={set("invoice_no")} />
          </div>
          <div>
            <label className="label" htmlFor="delivery_note_no">İrsaliye numarası</label>
            <input id="delivery_note_no" name="delivery_note_no" className="input"
                   value={v.delivery_note_no} onChange={set("delivery_note_no")} />
          </div>
          <div>
            <label className="label" htmlFor="contract_no">Sözleşme numarası</label>
            <input id="contract_no" name="contract_no" className="input"
                   value={v.contract_no} onChange={set("contract_no")} />
          </div>
          <div>
            <label className="label" htmlFor="delivery_date">Teslim tarihi</label>
            <input id="delivery_date" name="delivery_date" type="date" className="input"
                   value={v.delivery_date} onChange={set("delivery_date")} />
          </div>
        </div>
      </fieldset>

      {/* ---------------- Adım 3: Şikâyet ---------------- */}
      <fieldset className={step === 3 ? "card" : "hidden"}>
        <legend className="sr-only">Şikâyet bilgileri</legend>
        <h2 className="card-title">3. Şikâyet</h2>
        <div className="grid grid-cols-1 gap-4 p-4 sm:p-5">
          <div>
            <label className="label" htmlFor="category_id">Şikâyet türü</label>
            <select id="category_id" name="category_id" className="input"
                    value={v.category_id} onChange={set("category_id")}>
              <option value="">Seçiniz (bilmiyorsanız boş bırakabilirsiniz)</option>
              {categoriesByFamily.map(([family, items]) => (
                <optgroup key={family} label={refs.familyLabels[family] ?? family}>
                  {items.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="subject">
              Şikâyet konusu <span className="text-danger-600">*</span>
            </label>
            <input id="subject" name="subject" className={cls("subject")} maxLength={200}
                   value={v.subject} onChange={set("subject")}
                   placeholder="Örnek: 50 kg çuvallarda topaklanma tespit edildi" />
            <Err k="subject" />
          </div>

          <div>
            <label className="label" htmlFor="description">Ayrıntılı açıklama</label>
            <textarea id="description" name="description" rows={5} className="input" maxLength={4000}
                      value={v.description} onChange={set("description")}
                      placeholder="Sorunu ne zaman fark ettiniz, kaç çuval/paket etkilendi, ürün nasıl depolandı gibi bilgileri yazabilirsiniz." />
            <span className="hint">{v.description.length} / 4000 karakter</span>
          </div>

          <div>
            <span className="label">Talebiniz <span className="text-danger-600">*</span></span>
            <div className="space-y-1.5">
              {(Object.keys(DEMAND_LABEL) as Demand[]).map((d) => (
                <label key={d} className="flex cursor-pointer items-start gap-2.5 rounded-[5px] border border-ink-200 px-3 py-2 hover:bg-ink-50 has-checked:border-brand-400 has-checked:bg-brand-50">
                  <input type="radio" name="demand" value={d} className="mt-0.5"
                         checked={v.demand === d}
                         onChange={() => setV((p) => ({ ...p, demand: d }))} />
                  <span className="text-sm">
                    {DEMAND_LABEL[d]}
                    {(d === "IADE_NAKLIYE" || d === "DEGISIM_NAKLIYE") && (
                      <span className="block text-xs text-ink-500">
                        Kusur fabrikamızdan kaynaklanıyorsa geliş-gidiş nakliye masrafınız tarafımızca ödenir.
                      </span>
                    )}
                  </span>
                </label>
              ))}
            </div>
            <Err k="demand" />
          </div>

          <div>
            <label className="label" htmlFor="kanit">Kanıt dosyaları (görsel, analiz raporu, fatura)</label>
            <input id="kanit" name="kanit" type="file" multiple accept={refs.accept}
                   className="input file:mr-3 file:rounded file:border-0 file:bg-ink-100 file:px-3 file:py-1.5 file:text-sm file:font-medium"
                   onChange={(e) => setFileNames([...(e.target.files ?? [])].map((f) => f.name))} />
            <span className="hint">
              En fazla {refs.maxFiles} dosya, her biri {refs.maxMb} MB'a kadar. JPG, PNG, WEBP, PDF, Word, Excel.
            </span>
            {fileNames.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-ink-600">
                {fileNames.map((n) => <li key={n}>• {n}</li>)}
              </ul>
            )}
          </div>
        </div>
      </fieldset>

      {/* ---------------- Adım 4: Onay ---------------- */}
      <fieldset className={step === 4 ? "space-y-5" : "hidden"}>
        <legend className="sr-only">Onay ve gönderim</legend>

        <div className="card">
          <h2 className="card-title">4. Gözden geçirin</h2>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 p-4 sm:grid-cols-2 sm:p-5">
            {[
              ["Başvuru sahibi", v.customer_company],
              ["Telefon", fmtPhone(v.customer_phone)],
              ["E-posta", v.customer_email || "—"],
              ["İl", refs.provinces.find((p) => p.code === v.customer_province)?.name ?? "—"],
              ["Üretici fabrika", selectedFactory?.name ?? "—"],
              ["Ürün", selectedProduct ? `${selectedProduct.name}${selectedProduct.packaging ? ` — ${selectedProduct.packaging}` : ""}` : "—"],
              ["Parti / Lot", v.lot_no || "—"],
              ["Miktar", v.quantity_kg ? `${v.quantity_kg} kg` : "—"],
              ["Şikâyet türü", selectedCategory?.name ?? "—"],
              ["Talep", DEMAND_LABEL[v.demand as Demand]],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs font-medium tracking-wide text-ink-500 uppercase">{label}</dt>
                <dd className="mt-0.5 text-sm break-words text-ink-900">{value}</dd>
              </div>
            ))}
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium tracking-wide text-ink-500 uppercase">Şikâyet konusu</dt>
              <dd className="mt-0.5 text-sm text-ink-900">{v.subject || "—"}</dd>
            </div>
            {v.description && (
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium tracking-wide text-ink-500 uppercase">Açıklama</dt>
                <dd className="mt-0.5 text-sm whitespace-pre-wrap text-ink-900">{v.description}</dd>
              </div>
            )}
            {fileNames.length > 0 && (
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium tracking-wide text-ink-500 uppercase">Ekler</dt>
                <dd className="mt-0.5 text-sm text-ink-900">{fileNames.join(", ")}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="card">
          <h2 className="card-title">Kişisel verilerin korunması</h2>
          <div className="p-4 sm:p-5">
            <div className="max-h-44 overflow-y-auto rounded-[5px] border border-ink-200 bg-ink-50 p-3 text-xs leading-relaxed text-ink-700">
              {refs.kvkkText}
            </div>
            <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-sm">
              <input type="checkbox" name="kvkk" value="1" className="mt-0.5"
                     checked={kvkk} onChange={(e) => setKvkk(e.target.checked)} />
              <span>
                Aydınlatma metnini okudum, kişisel verilerimin şikâyetimin incelenmesi amacıyla
                işlenmesini kabul ediyorum. <span className="text-danger-600">*</span>
              </span>
            </label>
            <Err k="kvkk" />
          </div>
        </div>

        {refs.otpRequired && (
          <div className="card">
            <h2 className="card-title">Telefon doğrulama</h2>
            <div className="space-y-3 p-4 sm:p-5">
              <p className="text-sm text-ink-600">
                Şikâyetinizi kaydetmeden önce <strong>{fmtPhone(v.customer_phone)}</strong> numarasını
                doğrulamamız gerekiyor. Bu, bilgilendirme SMS'lerinin doğru numaraya gitmesini sağlar.
              </p>
              <div className="flex flex-wrap items-end gap-3">
                <button type="button" onClick={handleSendOtp} disabled={otpSending}
                        className="btn btn-secondary">
                  {otpSending ? "Gönderiliyor…" : otpSent ? "Kodu yeniden gönder" : "Doğrulama kodu gönder"}
                </button>
                <div className="w-40">
                  <label className="label" htmlFor="otp_code">6 haneli kod</label>
                  <input id="otp_code" name="otp_code" inputMode="numeric" maxLength={6}
                         className={`${cls("otp_code")} tnum text-center text-lg tracking-[0.3em]`}
                         value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                         placeholder="— — — — — —" autoComplete="one-time-code" />
                </div>
              </div>
              {otpInfo && <Notice tone="info">{otpInfo}</Notice>}
              <Err k="otp_code" />
            </div>
          </div>
        )}

        <Notice tone="brand" title="Şikâyetiniz kaydedildikten sonra">
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            <li>Size bir şikâyet numarası ve takip bağlantısı SMS ile gönderilir.</li>
            <li>En geç <strong>1 iş günü</strong> içinde inceleme ekibi oluşturulur.</li>
            <li>En geç <strong>3 iş günü</strong> içinde inceleme tamamlanır ve tutanak düzenlenir.</li>
            <li>
              Şikâyetiniz haklı bulunursa en geç <strong>5 iş günü</strong> içinde iade veya değişim yapılır.
            </li>
          </ul>
        </Notice>
      </fieldset>

      {/* ---------------- Gezinme ---------------- */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={back} disabled={step === 1 || pending}
                className="btn btn-secondary">← Geri</button>
        <p className="text-xs text-ink-500">Adım {step} / 4 — {CHANNEL_LABEL.WEB} başvurusu</p>
        {step < 4 ? (
          <button type="button" onClick={next} className="btn btn-primary">İleri →</button>
        ) : (
          <button type="submit" disabled={pending} className="btn btn-primary">
            {pending ? "Kaydediliyor…" : "Şikâyeti gönder"}
          </button>
        )}
      </div>
    </form>
  );
}
