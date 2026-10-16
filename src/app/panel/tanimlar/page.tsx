import Link from "next/link";
import { redirect } from "next/navigation";
import { all, scalar } from "@/lib/db";
import { PERMISSIONS, ROLE_LABEL, can, type Role } from "@/lib/roles";
import { PRODUCT_GROUP_LABEL, type ProductGroup } from "@/lib/domain";
import { fmtDate, today } from "@/lib/dates";
import { kategoriAilesi } from "@/lib/category-labels";
import {requirePageUser} from "@/server/auth";
import { isDemoMode } from "@/server/settings";
import { TEMPLATE, TEMPLATE_LABEL, previewSms, type TemplateCode } from "@/server/notify";
import { mailProvider, smsProvider } from "@/server/providers";
import { Card, Chip, Notice, PageHeader, Tabs } from "@/components/ui";
import { DemoDataForms, HolidayDelete, HolidayForm, SettingsForm, type SettingField } from "./forms";

export const dynamic = "force-dynamic";

export default async function DefinitionsPage({
  searchParams,
}: {
  searchParams: Promise<{ sekme?: string; tatil?: string }>;
}) {
  const q = await searchParams;
  const sekme = q.sekme;
  const user = await requirePageUser();
  if (!can(user.role, PERMISSIONS.TANIM_YONET)) redirect("/panel");

  const tab = sekme ?? "ozet";
  const complaintCount = scalar<number>("SELECT COUNT(*) FROM complaints") ?? 0;
  const demo = isDemoMode();

  const settings = Object.fromEntries(
    all<{ key: string; value: string }>("SELECT key, value FROM settings").map((s) => [s.key, s.value]),
  );

  /*
   * İki ölü alan kaldırıldı: "Uygulama adı" ve "SMS gönderen başlığı" hiçbir
   * yerde okunmuyordu — kaydedilen değerin hiçbir etkisi olmuyor, ekran
   * yöneticiye yanlış bir denetim duygusu veriyordu. SMS başlığı gerçekte
   * ortam değişkeninden (SMS_SENDER_TITLE) geliyor.
   *
   * Kalanlar ikiye ayrılır: günlük açılıp kapanan anahtarlar üstte, kurulumda
   * bir kez girilip bir daha dokunulmayanlar "Gelişmiş" katında.
   */
  const fields: SettingField[] = [
    { key: "kurum_adi", label: "Kurum adı", value: settings.kurum_adi ?? "", type: "text" },
    {
      key: "halka_acik_form_aktif", label: "Halka açık şikâyet formu",
      value: settings.halka_acik_form_aktif ?? "1", type: "bool",
      hint: "Kapatılırsa müşteriler çevrim içi kayıt açamaz.",
    },
    {
      key: "otp_zorunlu", label: "SMS doğrulaması zorunlu",
      value: settings.otp_zorunlu ?? "1", type: "bool",
      hint: "Kapatılırsa telefon doğrulanmadan kayıt açılabilir.",
    },
    {
      key: "otp_gecerlilik_dk", label: "Doğrulama kodu geçerliliği (dakika)",
      value: settings.otp_gecerlilik_dk ?? "10", type: "number",
    },
    {
      key: "form_saatlik_ip_limiti", label: "Saatlik IP başına kayıt sınırı",
      value: settings.form_saatlik_ip_limiti ?? "5", type: "number",
      hint: "Kötüye kullanımı sınırlar.",
    },
    {
      key: "sms_turkce_karakter", label: "SMS'lerde Türkçe karakter",
      value: settings.sms_turkce_karakter ?? "0", type: "bool",
      hint: "Açılırsa mesajlar UCS-2'ye düşer; segment başına 160 yerine 70 karakter olur ve SMS maliyeti artar.",
    },
    {
      key: "ek_dosya_max_mb", label: "Tek dosya üst sınırı (MB)",
      value: settings.ek_dosya_max_mb ?? "10", type: "number",
    },
    {
      key: "ek_dosya_max_adet", label: "Şikâyet başına en fazla kanıt dosyası",
      value: settings.ek_dosya_max_adet ?? "8", type: "number",
    },
    {
      key: "kvkk_metni", label: "KVKK aydınlatma metni",
      value: settings.kvkk_metni ?? "", type: "textarea",
      hint: "Halka açık formun son adımında gösterilir.",
    },
  ];

  const SIK = new Set(["halka_acik_form_aktif", "otp_zorunlu", "kvkk_metni"]);
  const sikAyarlar = fields.filter((f) => SIK.has(f.key));
  const gelismisAyarlar = fields.filter((f) => !SIK.has(f.key));

  const factories = all<{ id: number; code: string; name: string; province: string; users: number }>(
    `SELECT f.id, f.code, f.name, f.province,
            (SELECT COUNT(*) FROM users u WHERE u.factory_id = f.id) AS users
       FROM factories f WHERE f.is_active = 1 ORDER BY f.short_name`,
  );
  const products = all<{ id: number; name: string; product_group: string; packaging: string | null }>(
    "SELECT id, name, product_group, packaging FROM products WHERE is_active = 1 ORDER BY sort_order",
  );
  const categories = all<{ id: number; name: string; family: string; is_critical: number }>(
    "SELECT id, name, family, is_critical FROM complaint_categories WHERE is_active = 1 ORDER BY sort_order",
  );
  /*
   * Yalnızca bundan sonrası. Geçmiş yılın tatilleri tabloyu ikiye katlıyor ve
   * her satırda "SLA hesapları değişir" uyarılı bir Sil düğmesi taşıyordu —
   * düzeltilecek olan daima önümüzdeki tarih. Geçmişi görmek isteyen
   * ?tatil=tumu ile açar.
   */
  const tumTatiller = q.tatil === "tumu";
  const holidays = all<{ date: string; name: string }>(
    tumTatiller
      ? "SELECT date, name FROM holidays WHERE date >= date('now','-1 year') ORDER BY date"
      : "SELECT date, name FROM holidays WHERE date >= date('now') ORDER BY date",
  );
  const departments = all<{ code: string; name: string; can_decide: number; users: number }>(
    `SELECT d.code, d.name, d.can_decide,
            (SELECT COUNT(*) FROM users u WHERE u.department_id = d.id) AS users
       FROM departments d ORDER BY d.id`,
  );
  const roleCounts = all<{ role: string; n: number }>(
    "SELECT role, COUNT(*) AS n FROM users WHERE is_active = 1 GROUP BY role ORDER BY role",
  );

  const tabs = [
    { key: "ozet", label: "Özet" },
    { key: "ayarlar", label: "Ayarlar" },
    { key: "tatil", label: "Resmî tatil takvimi", count: holidays.length },
    { key: "tanim", label: "Fabrika, ürün, kategori" },
    { key: "sms", label: "Bildirim şablonları" },
    ...(demo ? [{ key: "demo", label: "Demo verisi" }] : []),
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Tanımlar ve ayarlar"
        subtitle={`${user.title} — sistem geneli tanımlar`}
      />

      <Tabs tabs={tabs} active={tab} baseHref="/panel/tanimlar" />

      {tab === "ozet" && (
        <div className="space-y-5">
          <Card title="Sistem durumu">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-3">
              {[
                ["Fabrika", `${factories.length} etkin`],
                ["Daire Başkanlığı", `${departments.length} tanımlı`],
                ["Kullanıcı", `${roleCounts.reduce((a, r) => a + r.n, 0)} etkin hesap`],
                ["Ürün", `${products.length} tanımlı`],
                ["Şikâyet kategorisi", `${categories.length} tanımlı`],
                ["Şikâyet dosyası", `${complaintCount} kayıt`],
                ["Resmî tatil", `${holidays.length} gün (son 1 yıl ve sonrası)`],
                ["Bugün", fmtDate(today())],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs font-medium tracking-wide text-ink-500 uppercase">{k}</dt>
                  <dd className="mt-0.5 text-sm text-ink-900">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card title="Çalışma modu">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-3">
              <div>
                <dt className="text-xs font-medium tracking-wide text-ink-500 uppercase">Demo modu</dt>
                <dd className="mt-1">
                  {demo
                    ? <Chip tone="warn" dot>Açık — rol değiştirme etkin</Chip>
                    : <Chip tone="ok" dot>Kapalı — canlı mod</Chip>}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium tracking-wide text-ink-500 uppercase">SMS sağlayıcısı</dt>
                <dd className="mt-1">
                  <Chip tone={smsProvider().name === "simulasyon" ? "warn" : "ok"} dot>
                    {smsProvider().name}
                  </Chip>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium tracking-wide text-ink-500 uppercase">E-posta sağlayıcısı</dt>
                <dd className="mt-1">
                  <Chip tone={mailProvider().name === "simulasyon" ? "warn" : "ok"} dot>
                    {mailProvider().name}
                  </Chip>
                </dd>
              </div>
            </dl>
            <Notice tone="info">
              Çalışma modu ve sağlayıcılar <code className="rounded bg-white px-1 py-0.5 text-xs">.env.local</code>{" "}
              dosyasından ayarlanır: <code className="rounded bg-white px-1 py-0.5 text-xs">DEMO_MODE</code>,{" "}
              <code className="rounded bg-white px-1 py-0.5 text-xs">SMS_PROVIDER</code>,{" "}
              <code className="rounded bg-white px-1 py-0.5 text-xs">MAIL_PROVIDER</code>. Değişiklikten
              sonra uygulamanın yeniden başlatılması gerekir.
            </Notice>
          </Card>

          <Card title="Rol dağılımı" bodyClass="">
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th>Rol</th><th className="text-right">Kullanıcı</th></tr></thead>
                <tbody>
                  {roleCounts.map((r) => (
                    <tr key={r.role}>
                      <td>{ROLE_LABEL[r.role as Role] ?? r.role}</td>
                      <td className="tnum text-right">{r.n}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {tab === "ayarlar" && (
        <Card title="Sistem ayarları">
          <SettingsForm fields={sikAyarlar} gelismis={gelismisAyarlar} />
        </Card>
      )}

      {tab === "tatil" && (
        <div className="space-y-5">
          <Notice tone="warn" title="Dinî bayram tarihlerini doğrulayın">
            Resmî tatiller tüm iş günü SLA hesaplarının temelidir (ekip 1, inceleme 3, işlem 5,
            resmî yazı 3, daire kararı 5 iş günü). Dinî bayram tarihleri astronomik hesaba göre ön
            tanımlı gelir; Diyanet İşleri Başkanlığının resmî ilanından sonra buradan düzeltilmelidir.
          </Notice>
          <Card title="Tatil ekle veya güncelle">
            <HolidayForm />
          </Card>
          <Card title={`Resmî tatil takvimi (${holidays.length} gün)`}
                actions={
                  <Link href={`/panel/tanimlar?sekme=tatil${tumTatiller ? "" : "&tatil=tumu"}`}
                        className="btn btn-ghost btn-sm">
                    {tumTatiller ? "Yalnızca bundan sonrası" : "Geçmişi de göster"}
                  </Link>
                }
                bodyClass="">
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th>Tarih</th><th>Tatil adı</th><th></th></tr></thead>
                <tbody>
                  {holidays.map((h) => (
                    <tr key={h.date}>
                      <td className="tnum whitespace-nowrap">{fmtDate(h.date)}</td>
                      <td>{h.name}</td>
                      <td className="text-right"><HolidayDelete date={h.date} name={h.name} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {tab === "tanim" && (
        <div className="space-y-5">
          <Card title={`Fabrikalar (${factories.length})`} bodyClass="">
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th>Kod</th><th>Fabrika</th><th>İl</th><th className="text-right">Personel</th></tr></thead>
                <tbody>
                  {factories.map((f) => (
                    <tr key={f.id}>
                      <td className="font-mono text-xs">{f.code}</td>
                      <td className="font-medium text-ink-800">{f.name}</td>
                      <td className="text-ink-600">{f.province}</td>
                      <td className="tnum text-right">{f.users}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title={`Genel Müdürlük Daire Başkanlıkları (${departments.length})`} bodyClass="">
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th>Daire</th><th>İtiraz kararı yetkisi</th><th className="text-right">Personel</th></tr></thead>
                <tbody>
                  {departments.map((d) => (
                    <tr key={d.code}>
                      <td className="font-medium text-ink-800">{d.name}</td>
                      <td>
                        {d.can_decide
                          ? <Chip tone="ok" dot>Var</Chip>
                          : <Chip tone="ink">Yok — yalnızca raporlama</Chip>}
                      </td>
                      <td className="tnum text-right">{d.users}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title={`Ürünler (${products.length})`} bodyClass="">
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th>Ürün</th><th>Ambalaj</th><th>Grup</th></tr></thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id}>
                      <td className="font-medium text-ink-800">{p.name}</td>
                      <td className="text-ink-600">{p.packaging ?? "—"}</td>
                      <td>{PRODUCT_GROUP_LABEL[p.product_group as ProductGroup] ?? p.product_group}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title={`Şikâyet kategorileri (${categories.length})`} bodyClass="">
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th>Kategori</th><th>Aile</th><th>Gıda güvenliği</th></tr></thead>
                <tbody>
                  {categories.map((c) => (
                    <tr key={c.id}>
                      <td className="font-medium text-ink-800">{c.name}</td>
                      <td className="text-ink-600">{kategoriAilesi(c.family)}</td>
                      <td>{c.is_critical ? <Chip tone="danger" dot>Kritik</Chip> : <span className="text-ink-400">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

        </div>
      )}

      {tab === "sms" && (
        <div className="space-y-5">
          <Notice tone="info" title="SMS kredisi nasıl hesaplanır?">
            GSM-7 alfabesi Türkçe ş, ğ, ı, İ karakterlerini içermez. Bu karakterler kullanıldığında
            mesaj UCS-2 kodlamasına düşer ve segment başına 160 yerine 70 karakter alınır — yani
            maliyet iki katına çıkar. Varsayılan olarak giden SMS'lerde Türkçe karakterler ASCII
            karşılıklarına çevrilir; bu davranış Ayarlar sekmesinden değiştirilebilir.
          </Notice>
          <Card title="Müşteriye giden SMS şablonları" bodyClass="">
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr><th>Kilometre taşı</th><th>Örnek metin</th><th>Kodlama</th><th className="text-right">Kredi</th></tr>
                </thead>
                <tbody>
                  {(Object.keys(TEMPLATE) as TemplateCode[]).map((code) => {
                    const p = previewSms(code);
                    return (
                      <tr key={code}>
                        <td className="font-medium whitespace-nowrap text-ink-800">
                          {TEMPLATE_LABEL[code]}
                        </td>
                        <td className="max-w-[34rem] text-xs text-ink-600">{p.text}</td>
                        <td><Chip tone={p.encoding === "GSM-7" ? "ok" : "warn"}>{p.encoding}</Chip></td>
                        <td className="tnum text-right">{p.segments}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {tab === "demo" && demo && <DemoDataForms complaintCount={complaintCount} />}
    </div>
  );
}
