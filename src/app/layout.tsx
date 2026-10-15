import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Müşteri Şikâyet Takip Sistemi | Türkiye Şeker Fabrikaları A.Ş.",
    template: "%s | Türkşeker Şikâyet Takip",
  },
  description:
    "Türkiye Şeker Fabrikaları A.Ş. müşteri şikâyetlerinin kaydı, incelenmesi ve " +
    "sonuçlandırılması için kurumsal takip sistemi.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#006938",   // marka yeşili — Android adres çubuğu bu rengi alır
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
