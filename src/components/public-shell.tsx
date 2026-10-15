import Link from "next/link";
import type { ReactNode } from "react";
import { Amblem, Logo } from "./marka";

/**
 * Halka açık sayfaların kurumsal çerçevesi. Üstte marka yeşili ince çizgi,
 * altında logo kilidi ve uygulamanın adı. Kurum sitesine dönüş bağlantısı
 * altbilgide durur: uygulamaya zaten oradan gelinir.
 */
export function PublicShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const en = wide ? "max-w-6xl" : "max-w-4xl";

  return (
    <div className="flex min-h-screen flex-col bg-ink-100">
      <div className="h-1 bg-brand-600" aria-hidden />

      <header className="border-b border-ink-200 bg-white">
        <div className={`mx-auto flex flex-wrap items-center justify-between gap-x-5 gap-y-3 px-4 py-3.5 ${en}`}>
          <Link href="/" className="flex items-center gap-3.5" aria-label="Ana sayfa">
            <Logo yukseklik={30} />
            <span className="border-l border-ink-200 pl-3.5 text-sm leading-tight font-medium text-ink-600">
              Müşteri Şikâyet
              <br />
              Takip Sistemi
            </span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link href="/takip" className="btn btn-ghost btn-sm">Şikâyet takibi</Link>
            <Link href="/giris" className="btn btn-secondary btn-sm">Personel girişi</Link>
          </nav>
        </div>
      </header>

      <main className={`mx-auto w-full flex-1 px-4 py-6 sm:py-8 ${en}`}>{children}</main>

      <footer className="border-t border-ink-200 bg-white">
        <div className={`mx-auto flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-4 text-xs leading-relaxed text-ink-500 ${en}`}>
          <p className="flex items-center gap-2">
            <Amblem boyut={18} />
            © {new Date().getFullYear()} Türkiye Şeker Fabrikaları A.Ş. · Kişisel verileriniz 6698
            sayılı KVKK kapsamında korunur.
          </p>
          <a href="https://www.turkseker.gov.tr" target="_blank" rel="noreferrer"
             className="link inline-flex min-h-6 items-center">
            turkseker.gov.tr
          </a>
        </div>
      </footer>
    </div>
  );
}
