/* ===========================================================================
   Bildirim motoru — kilometre taşlarında müşteriye SMS ve e-posta.
   Her gönderim notifications tablosuna yazılır; panelde Giden Kutusu'ndan
   izlenir ve hatalı olanlar yeniden gönderilebilir.
   =========================================================================== */

import { all, one, run } from "@/lib/db";
import { fmtDate, fmtDateLong } from "@/lib/dates";
import { fmtTl, normalizePhone } from "@/lib/format";
import { asciify, smsMetrics } from "./sms-text";
import { mailProvider, smsProvider } from "./providers";
import { getSetting } from "./settings";

export const TEMPLATE = {
  OTP: "OTP",
  KAYIT: "KAYIT",
  EKIP: "EKIP",
  YONLENDIRME: "YONLENDIRME",
  ZIYARET: "ZIYARET",
  NUMUNE: "NUMUNE",
  KARAR_HAKLI: "KARAR_HAKLI",
  KARAR_HAKSIZ: "KARAR_HAKSIZ",
  ITIRAZ_BASLADI: "ITIRAZ_BASLADI",
  ITIRAZ_SONUC: "ITIRAZ_SONUC",
  ISLEM_TAMAM: "ISLEM_TAMAM",
  KAPANIS: "KAPANIS",
} as const;
export type TemplateCode = (typeof TEMPLATE)[keyof typeof TEMPLATE];

export const TEMPLATE_LABEL: Record<TemplateCode, string> = {
  OTP: "Telefon doğrulama kodu",
  KAYIT: "Şikâyet kaydı alındı",
  EKIP: "İnceleme ekibi oluşturuldu",
  YONLENDIRME: "Daha yakın fabrikaya yönlendirildi",
  ZIYARET: "Yerinde inceleme yapıldı",
  NUMUNE: "Numune alındı / analiz başladı",
  KARAR_HAKLI: "Şikâyet haklı bulundu",
  KARAR_HAKSIZ: "Şikâyet haklı bulunmadı",
  ITIRAZ_BASLADI: "Genel Müdürlük değerlendirmesine gönderildi",
  ITIRAZ_SONUC: "Genel Müdürlük kararı açıklandı",
  ISLEM_TAMAM: "İade / değişim işlemi tamamlandı",
  KAPANIS: "Şikâyet kapatıldı",
};

export interface NotifyContext {
  complaintNo: string;
  trackingToken: string;
  factoryName?: string;
  customerCompany?: string;
  dueDate?: string | null;
  date?: string | null;
  departmentName?: string;
  freightAmount?: number;
  returnedKg?: number;
  exchangedKg?: number;
  verdictReason?: string;
  otpCode?: string;
  otpMinutes?: number;
  extra?: string;
}

function baseUrl(): string {
  return (process.env.APP_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export function trackingUrl(token: string): string {
  return `${baseUrl()}/takip/${token}`;
}

/* --- SMS metinleri ------------------------------------------------------- */

function smsBody(code: TemplateCode, c: NotifyContext): string {
  const link = trackingUrl(c.trackingToken);
  switch (code) {
    case "OTP":
      return `Turkseker sikayet dogrulama kodunuz: ${c.otpCode}. ` +
             `Kod ${c.otpMinutes ?? 10} dakika gecerlidir. Kimseyle paylasmayin.`;
    case "KAYIT":
      return `Sikayetiniz alinmistir. Sikayet No: ${c.complaintNo}. ` +
             `${c.factoryName ?? "Ilgili fabrika"} tarafindan incelenecektir. Takip: ${link}`;
    case "EKIP":
      return `${c.complaintNo} nolu sikayetiniz icin inceleme ekibi olusturuldu. ` +
             `En gec ${fmtDate(c.dueDate)} tarihine kadar inceleme tamamlanacaktir. Takip: ${link}`;
    case "YONLENDIRME":
      return `${c.complaintNo} nolu sikayetiniz, adresinize daha yakin olan ` +
             `${c.factoryName ?? "diger fabrikamiz"} tarafindan incelenecektir. Takip: ${link}`;
    case "ZIYARET":
      return `${c.complaintNo} nolu sikayetiniz icin ${fmtDate(c.date)} tarihinde yerinde ` +
             `inceleme yapildi. Takip: ${link}`;
    case "NUMUNE":
      return `${c.complaintNo} nolu sikayetiniz icin numune alinmistir. Laboratuvar analizi ` +
             `surmektedir. Takip: ${link}`;
    case "KARAR_HAKLI":
      return `${c.complaintNo} nolu sikayetiniz hakli bulunmustur. Iade/degisim islemi en gec ` +
             `${fmtDate(c.dueDate)} tarihine kadar tamamlanacaktir. Takip: ${link}`;
    case "KARAR_HAKSIZ":
      return `${c.complaintNo} nolu sikayetinizin incelemesi tamamlandi; urun ilgili ` +
             `standartlara uygun bulundu. Ayrintili bilgi: ${link}`;
    case "ITIRAZ_BASLADI":
      return `${c.complaintNo} nolu sikayetiniz Genel Mudurlugumuz tarafindan yeniden ` +
             `degerlendirilecektir. Sonuc en gec ${fmtDate(c.dueDate)} tarihinde bildirilecektir. ${link}`;
    case "ITIRAZ_SONUC":
      return `${c.complaintNo} nolu sikayetinizle ilgili Genel Mudurluk degerlendirmesi ` +
             `tamamlanmistir. Sonuc: ${link}`;
    case "ISLEM_TAMAM":
      return `${c.complaintNo} nolu sikayetinizde iade/degisim islemi tamamlanmistir` +
             `${c.freightAmount ? " ve nakliye bedeli odenmistir" : ""}. Takip: ${link}`;
    case "KAPANIS":
      return `${c.complaintNo} nolu sikayetiniz kapatilmistir. Bilgilendirme formu tarafiniza ` +
             `iletilmistir. Ilginiz icin tesekkur ederiz.`;
    default:
      return `${c.complaintNo} nolu sikayetinizde guncelleme var. Takip: ${link}`;
  }
}

/* --- E-posta metinleri --------------------------------------------------- */

function mailSubject(code: TemplateCode, c: NotifyContext): string {
  const no = c.complaintNo;
  switch (code) {
    case "KAYIT": return `Şikâyet kaydınız alındı — ${no}`;
    case "EKIP": return `İnceleme ekibi oluşturuldu — ${no}`;
    case "YONLENDIRME": return `Şikâyetiniz yönlendirildi — ${no}`;
    case "ZIYARET": return `Yerinde inceleme yapıldı — ${no}`;
    case "NUMUNE": return `Numune alındı, analiz sürüyor — ${no}`;
    case "KARAR_HAKLI": return `Şikâyetiniz haklı bulundu — ${no}`;
    case "KARAR_HAKSIZ": return `İnceleme sonucu — ${no}`;
    case "ITIRAZ_BASLADI": return `Genel Müdürlük değerlendirmesi başladı — ${no}`;
    case "ITIRAZ_SONUC": return `Genel Müdürlük kararı — ${no}`;
    case "ISLEM_TAMAM": return `İade / değişim işlemi tamamlandı — ${no}`;
    case "KAPANIS": return `Şikâyetiniz kapatıldı — ${no}`;
    default: return `Şikâyet bildirimi — ${no}`;
  }
}

function mailBody(code: TemplateCode, c: NotifyContext): string {
  const link = trackingUrl(c.trackingToken);
  const hitap = c.customerCompany ? `Sayın ${c.customerCompany},` : "Sayın ilgili,";
  const alt =
    `\n\nŞikâyetinizin güncel durumunu aşağıdaki adresten izleyebilirsiniz:\n${link}\n\n` +
    `Saygılarımızla,\nTürkiye Şeker Fabrikaları A.Ş.\n` +
    `${c.factoryName ?? ""}`.trimEnd();

  let govde: string;
  switch (code) {
    case "KAYIT":
      govde =
        `${c.complaintNo} numaralı şikâyet kaydınız alınmıştır.\n\n` +
        `Şikâyetiniz ${c.factoryName ?? "ilgili fabrikamız"} tarafından ISO 9001:2015 Kalite ` +
        `Yönetim Sistemi kapsamında incelenecektir. Mevzuatımız gereği:\n` +
        `• En geç 1 iş günü içinde inceleme ekibi oluşturulur,\n` +
        `• En geç 3 iş günü içinde inceleme tamamlanıp tutanak düzenlenir,\n` +
        `• Şikâyetin haklı bulunması halinde en geç 5 iş günü içinde iade veya değişim yapılır.`;
      break;
    case "EKIP":
      govde =
        `${c.complaintNo} numaralı şikâyetiniz için Kalite ve İşletme Kontrol, Teknik ` +
        `(İşletme), Muhasebe ve Ziraat birimlerinden oluşan inceleme ekibi görevlendirilmiştir.\n\n` +
        `İnceleme en geç ${fmtDateLong(c.dueDate)} tarihine kadar tamamlanacaktır.`;
      break;
    case "YONLENDIRME":
      govde =
        `${c.complaintNo} numaralı şikâyetiniz, adresinize daha yakın olan ` +
        `${c.factoryName ?? "fabrikamız"} tarafından incelenmek üzere yönlendirilmiştir.\n\n` +
        `İlgili fabrika, dosyanın kendisine ulaşmasından itibaren en geç 1 iş günü içinde ` +
        `inceleme ekibini oluşturacaktır.`;
      break;
    case "ZIYARET":
      govde =
        `${c.complaintNo} numaralı şikâyetiniz kapsamında ${fmtDateLong(c.date)} tarihinde ` +
        `yerinde inceleme gerçekleştirilmiştir.`;
      break;
    case "NUMUNE":
      govde =
        `${c.complaintNo} numaralı şikâyetiniz kapsamında numune alınmış olup Kalite ve ` +
        `İşletme Kontrol Laboratuvarımızda analiz süreci başlatılmıştır.`;
      break;
    case "KARAR_HAKLI":
      govde =
        `${c.complaintNo} numaralı şikâyetiniz yapılan inceleme ve analizler sonucunda ` +
        `HAKLI bulunmuştur.\n\n` +
        `İnceleme sonucu: ${c.verdictReason ?? "—"}\n\n` +
        `Müşteri memnuniyeti çerçevesinde iade/değişim işleminiz en geç ` +
        `${fmtDateLong(c.dueDate)} tarihine kadar tamamlanacaktır.`;
      break;
    case "KARAR_HAKSIZ":
      govde =
        `${c.complaintNo} numaralı şikâyetiniz kapsamında yapılan inceleme ve analizler ` +
        `sonucunda ürünün ilgili kalite standartlarına ve satış sözleşmesine uygun olduğu ` +
        `tespit edilmiştir.\n\nİnceleme sonucu: ${c.verdictReason ?? "—"}`;
      break;
    case "ITIRAZ_BASLADI":
      govde =
        `${c.complaintNo} numaralı şikâyetinize ilişkin itirazınız Genel Müdürlüğümüz ` +
        `${c.departmentName ?? ""} birimine iletilmiştir.\n\n` +
        `İtiraz en geç ${fmtDateLong(c.dueDate)} tarihine kadar değerlendirilip karara ` +
        `bağlanacaktır.`;
      break;
    case "ITIRAZ_SONUC":
      govde =
        `${c.complaintNo} numaralı şikâyetinize ilişkin Genel Müdürlük değerlendirmesi ` +
        `tamamlanmıştır.\n\nKarar: ${c.extra ?? "—"}`;
      break;
    case "ISLEM_TAMAM": {
      const satirlar = [
        c.returnedKg ? `• İade alınan miktar: ${c.returnedKg.toLocaleString("tr-TR")} kg` : null,
        c.exchangedKg ? `• Değişimi yapılan miktar: ${c.exchangedKg.toLocaleString("tr-TR")} kg` : null,
        c.freightAmount ? `• Ödenen nakliye bedeli: ${fmtTl(c.freightAmount)}` : null,
      ].filter(Boolean).join("\n");
      govde =
        `${c.complaintNo} numaralı şikâyetinize ilişkin işlemler ` +
        `${fmtDateLong(c.date)} tarihinde tamamlanmıştır.\n\n${satirlar}`;
      break;
    }
    case "KAPANIS":
      govde =
        `${c.complaintNo} numaralı şikâyet dosyanız kapatılmıştır.\n\n` +
        `${c.extra ?? ""}\n\nŞikâyetinizi bize bildirdiğiniz için teşekkür ederiz; ` +
        `görüşleriniz ürün ve hizmet kalitemizi geliştirmemize katkı sağlamaktadır.`;
      break;
    default:
      govde = `${c.complaintNo} numaralı şikâyetinizde bir güncelleme yapılmıştır.`;
  }
  return `${hitap}\n\n${govde}${alt}`;
}

/* --- Gönderim ------------------------------------------------------------ */

export interface QueueOptions {
  complaintId: number | null;
  code: TemplateCode;
  ctx: NotifyContext;
  phone?: string | null;
  email?: string | null;
  /** Yalnızca bu kanallara gönder. Varsayılan: ikisi de. */
  channels?: ("SMS" | "EPOSTA")[];
}

/**
 * Bildirimi kuyruğa yazar ve hemen göndermeyi dener.
 * Gönderim başarısız olsa bile kayıt kalır; Giden Kutusu'ndan yeniden denenebilir.
 */
export async function notifyCustomer(opts: QueueOptions): Promise<void> {
  const channels = opts.channels ?? ["SMS", "EPOSTA"];
  const useTurkishChars = getSetting("sms_turkce_karakter", "0") === "1";

  if (channels.includes("SMS") && opts.phone) {
    const phone = normalizePhone(opts.phone);
    const raw = smsBody(opts.code, opts.ctx);
    const text = useTurkishChars ? raw : asciify(raw);
    const m = smsMetrics(text);
    const id = Number(
      run(
        `INSERT INTO notifications (complaint_id, channel, template_code, recipient, body, status, segments)
         VALUES (?, 'SMS', ?, ?, ?, 'KUYRUKTA', ?)`,
        opts.complaintId, opts.code, phone, text, m.segments,
      ).lastInsertRowid,
    );
    await deliver(id);
  }

  if (channels.includes("EPOSTA") && opts.email && opts.code !== TEMPLATE.OTP) {
    const id = Number(
      run(
        `INSERT INTO notifications (complaint_id, channel, template_code, recipient, subject, body, status)
         VALUES (?, 'EPOSTA', ?, ?, ?, ?, 'KUYRUKTA')`,
        opts.complaintId, opts.code, opts.email.trim(),
        mailSubject(opts.code, opts.ctx), mailBody(opts.code, opts.ctx),
      ).lastInsertRowid,
    );
    await deliver(id);
  }
}

interface NotificationRow {
  id: number;
  channel: string;
  recipient: string;
  subject: string | null;
  body: string;
  attempts: number;
}

/** Kuyruktaki tek bir bildirimi gönderir. */
export async function deliver(id: number): Promise<boolean> {
  const n = one<NotificationRow>(
    "SELECT id, channel, recipient, subject, body, attempts FROM notifications WHERE id = ?",
    id,
  );
  if (!n) return false;

  const result =
    n.channel === "SMS"
      ? await smsProvider().send(n.recipient, n.body)
      : await mailProvider().send(n.recipient, n.subject ?? "", n.body);

  const provider = n.channel === "SMS" ? smsProvider().name : mailProvider().name;
  run(
    `UPDATE notifications
        SET status = ?, provider = ?, provider_ref = ?, error = ?,
            attempts = attempts + 1, sent_at = ?
      WHERE id = ?`,
    result.ok ? "GONDERILDI" : "HATA",
    provider,
    result.ref ?? null,
    result.error ?? null,
    result.ok ? new Date().toISOString().slice(0, 19).replace("T", " ") : null,
    id,
  );
  return result.ok;
}

/** Hatalı tüm bildirimleri yeniden gönderir. */
export async function retryFailed(complaintId?: number): Promise<number> {
  const rows = complaintId
    ? all<{ id: number }>("SELECT id FROM notifications WHERE status = 'HATA' AND complaint_id = ?", complaintId)
    : all<{ id: number }>("SELECT id FROM notifications WHERE status = 'HATA'");
  let ok = 0;
  for (const r of rows) if (await deliver(r.id)) ok++;
  return ok;
}

/** Şablonun örnek SMS metni — Tanımlar ekranında önizleme için. */
export function previewSms(code: TemplateCode): { text: string; segments: number; encoding: string } {
  const raw = smsBody(code, {
    complaintNo: "2026-ANK-0042",
    trackingToken: "ORNEK-TAKIP-JETONU",
    factoryName: "Ankara Şeker Fabrikası",
    dueDate: "2026-10-20",
    date: "2026-10-15",
    otpCode: "483920",
    otpMinutes: 10,
    freightAmount: 4500,
  });
  const useTurkishChars = getSetting("sms_turkce_karakter", "0") === "1";
  const text = useTurkishChars ? raw : asciify(raw);
  const m = smsMetrics(text);
  return { text, segments: m.segments, encoding: m.encoding };
}
