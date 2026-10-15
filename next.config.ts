import type { NextConfig } from "next";

/*
 * Uygulamaya kendi adresi dışında bir adresten erişilecekse (ters vekil sunucu,
 * geçici tünel ya da kurumsal alan adı) o adres burada tanınmalıdır.
 *
 * Next.js, Server Action isteklerinde `origin` ile `x-forwarded-host`
 * başlıklarının eşleşmesini arar; eşleşmezse isteği "Invalid Server Actions
 * request" diyerek reddeder. Bu uygulamanın her düğmesi bir Server Action
 * olduğu için, tanıtım amacıyla açılan bir tünelin arkasında giriş bile
 * çalışmaz. Adresi `.env.local` içinde ALLOWED_ORIGINS ile verin:
 *
 *   ALLOWED_ORIGINS=ornek.trycloudflare.com
 *   ALLOWED_ORIGINS=sikayet.turkseker.gov.tr,10.0.0.5:3000   (virgülle birden çok)
 *
 * Şema (https://) yazılmaz, yalnızca ana makine adı ve gerekiyorsa kapı.
 */
const izinliKaynaklar = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim().replace(/^https?:\/\//, "").replace(/\/$/, ""))
  .filter(Boolean);

const nextConfig: NextConfig = {
  // Yerleşik node:sqlite kullanıldığı için derlenmesi gereken yerel paket yoktur.
  serverExternalPackages: ["exceljs"],
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
      ...(izinliKaynaklar.length > 0 ? { allowedOrigins: izinliKaynaklar } : {}),
    },
  },
  // Türkşeker kurumsal sitesine <iframe> ile gömülecekse buradan izin verilir.
  async headers() {
    return [
      {
        source: "/sikayet/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex" }],
      },
    ];
  },
};

export default nextConfig;
