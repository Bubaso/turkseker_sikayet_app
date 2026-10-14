import Link from "next/link";
import type { ReactNode } from "react";

/** Halka açık sayfaların kurumsal çerçevesi. */
export function PublicShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="flex min-h-screen flex-col bg-ink-100">
      <div className="h-1 bg-kurum-500" aria-hidden />
      <header className="border-b border-ink-200 bg-white">
        <div className={`mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-3 ${wide ? "max-w-6xl" : "max-w-4xl"}`}>
          <Link href="/" className="flex items-center gap-3">
            <span
              className="flex size-10 shrink-0 items-center justify-center rounded-[5px] bg-brand-700 text-[11px] leading-tight font-bold text-white"
              aria-hidden
            >
              TŞ
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-semibold text-ink-900">
                Türkiye Şeker Fabrikaları A.Ş.
              </span>
              <span className="block text-xs text-ink-500">Müşteri Şikâyet Takip Sistemi</span>
            </span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link href="/takip" className="btn btn-ghost btn-sm">Şikâyet takibi</Link>
            <Link href="/giris" className="btn btn-secondary btn-sm">Personel girişi</Link>
          </nav>
        </div>
      </header>

      <main className={`mx-auto w-full flex-1 px-4 py-6 sm:py-8 ${wide ? "max-w-6xl" : "max-w-4xl"}`}>
        {children}
      </main>

      <footer className="border-t border-ink-200 bg-white">
        <div className={`mx-auto px-4 py-4 text-xs leading-relaxed text-ink-500 ${wide ? "max-w-6xl" : "max-w-4xl"}`}>
          <p>
            © {new Date().getFullYear()} Türkiye Şeker Fabrikaları A.Ş. · Kişisel verileriniz 6698
            sayılı KVKK kapsamında korunur.
          </p>
        </div>
      </footer>
    </div>
  );
}
