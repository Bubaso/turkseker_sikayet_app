import { env, envNumber, envOptional } from "@/lib/env";

/* ===========================================================================
   SMS ve e-posta sağlayıcı adaptörleri.
   Varsayılan "simulasyon" sağlayıcısı dış dünyaya çıkmaz; mesajlar
   veritabanına yazılır ve panelde Giden Kutusu'nda görünür.
   Canlıya geçiş: .env.local içinde SMS_PROVIDER / MAIL_PROVIDER değiştirilir.
   =========================================================================== */

export interface SendResult {
  ok: boolean;
  /** Sağlayıcının verdiği takip numarası. */
  ref?: string;
  error?: string;
}

export interface SmsProvider {
  name: string;
  /** phone: 10 haneli (5XXXXXXXXX) */
  send(phone: string, text: string): Promise<SendResult>;
}

export interface MailProvider {
  name: string;
  send(to: string, subject: string, text: string): Promise<SendResult>;
}

/* --- Simülasyon ---------------------------------------------------------- */

const simulasyonSms: SmsProvider = {
  name: "simulasyon",
  async send() {
    return { ok: true, ref: `SIM-${Date.now().toString(36).toUpperCase()}` };
  },
};

const simulasyonMail: MailProvider = {
  name: "simulasyon",
  async send() {
    return { ok: true, ref: `SIM-${Date.now().toString(36).toUpperCase()}` };
  },
};

/* --- NetGSM -------------------------------------------------------------- */

const netgsm: SmsProvider = {
  name: "netgsm",
  async send(phone, text) {
    const user = envOptional("NETGSM_USERNAME");
    const pass = envOptional("NETGSM_PASSWORD");
    const header = env("SMS_SENDER_TITLE", "TURKSEKER");
    if (!user || !pass) {
      return { ok: false, error: "NETGSM_USERNAME / NETGSM_PASSWORD tanımlı değil." };
    }
    try {
      const body = new URLSearchParams({
        usercode: user, password: pass, gsmno: `90${phone}`,
        message: text, msgheader: header, dil: "TR",
      });
      const res = await fetch("https://api.netgsm.com.tr/sms/send/get", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      const raw = (await res.text()).trim();
      // "00 <jobid>" veya "01 <jobid>" başarı; diğerleri hata kodudur.
      const code = raw.split(/\s+/)[0];
      if (code === "00" || code === "01" || code === "02") {
        return { ok: true, ref: raw.split(/\s+/)[1] ?? raw };
      }
      return { ok: false, error: `NetGSM hata kodu: ${raw}` };
    } catch (e) {
      return { ok: false, error: `NetGSM bağlantı hatası: ${(e as Error).message}` };
    }
  },
};

/* --- İleti Merkezi ------------------------------------------------------- */

const iletimerkezi: SmsProvider = {
  name: "iletimerkezi",
  async send(phone, text) {
    const key = envOptional("ILETIMERKEZI_KEY");
    const hash = envOptional("ILETIMERKEZI_HASH");
    const sender = env("SMS_SENDER_TITLE", "TURKSEKER");
    if (!key || !hash) {
      return { ok: false, error: "ILETIMERKEZI_KEY / ILETIMERKEZI_HASH tanımlı değil." };
    }
    try {
      const res = await fetch("https://api.iletimerkezi.com/v1/send-sms/json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request: {
            authentication: { key, hash },
            order: { sender, message: { text, receipents: { number: [`0${phone}`] } } },
          },
        }),
      });
      const data = (await res.json()) as {
        response?: { status?: { code?: number; message?: string }; order?: { id?: string } };
      };
      const code = data.response?.status?.code;
      if (code === 200) return { ok: true, ref: data.response?.order?.id ?? "" };
      return { ok: false, error: `İleti Merkezi: ${code} ${data.response?.status?.message ?? ""}` };
    } catch (e) {
      return { ok: false, error: `İleti Merkezi bağlantı hatası: ${(e as Error).message}` };
    }
  },
};

/* --- SMTP (nodemailer gerektirir) ---------------------------------------- */

interface NodemailerModule {
  createTransport?: (o: unknown) => NodemailerTransport;
  default?: { createTransport: (o: unknown) => NodemailerTransport };
}
interface NodemailerTransport {
  sendMail: (m: unknown) => Promise<{ messageId: string }>;
}

const smtp: MailProvider = {
  name: "smtp",
  async send(to, subject, text) {
    const host = envOptional("SMTP_HOST");
    if (!host) return { ok: false, error: "SMTP_HOST tanımlı değil." };
    try {
      // nodemailer isteğe bağlı bir pakettir; yalnızca SMTP seçildiğinde yüklenir.
      // Paket adı değişken üzerinden verilir ki kurulu olmadığında derleme bozulmasın.
      const pkg = "nodemailer";
      const mod = (await import(/* webpackIgnore: true */ pkg).catch(() => null)) as NodemailerModule | null;
      if (!mod) {
        return {
          ok: false,
          error: "SMTP sağlayıcısı için 'nodemailer' paketi kurulmalı: npm install nodemailer",
        };
      }
      const createTransport = mod.default?.createTransport ?? mod.createTransport;
      if (!createTransport) return { ok: false, error: "nodemailer yüklenemedi." };
      const transport = createTransport({
        host,
        port: envNumber("SMTP_PORT", 587),
        secure: envNumber("SMTP_PORT", 587) === 465,
        auth: envOptional("SMTP_USER")
          ? { user: envOptional("SMTP_USER"), pass: envOptional("SMTP_PASSWORD") }
          : undefined,
      });
      const info = await transport.sendMail({
        from: env("MAIL_FROM", "sikayet@turkseker.gov.tr"),
        to, subject, text,
      });
      return { ok: true, ref: info.messageId };
    } catch (e) {
      return { ok: false, error: `SMTP hatası: ${(e as Error).message}` };
    }
  },
};

/* --- Seçiciler ----------------------------------------------------------- */

export function smsProvider(): SmsProvider {
  switch (env("SMS_PROVIDER", "simulasyon").toLowerCase()) {
    case "netgsm": return netgsm;
    case "iletimerkezi": return iletimerkezi;
    default: return simulasyonSms;
  }
}

export function mailProvider(): MailProvider {
  switch (env("MAIL_PROVIDER", "simulasyon").toLowerCase()) {
    case "smtp": return smtp;
    default: return simulasyonMail;
  }
}

export function isSimulation(): boolean {
  return smsProvider().name === "simulasyon";
}
