import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { all } from "@/lib/db";
import { ROLE_LABEL, type Role } from "@/lib/roles";
import { currentUser } from "@/server/auth";
import { isDemoMode } from "@/server/settings";
import { PublicShell } from "@/components/public-shell";
import { LogoDikey } from "@/components/marka";
import LoginForm from "./form";

export const metadata: Metadata = { title: "Personel girişi" };
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  if (await currentUser()) redirect(next ?? "/panel");

  const demo = isDemoMode();
  const samples = demo
    ? all<{ username: string; title: string; role: string; factory: string | null }>(
        `SELECT u.username, u.title, u.role, f.short_name AS factory
           FROM users u LEFT JOIN factories f ON f.id = u.factory_id
          WHERE u.username IN ('ank.mudur','ank.kalite','ank.lab','ank.ambar',
                               'gm.pazarlama','gm.genelmudur','sistem')
          ORDER BY u.id`,
      )
    : [];

  return (
    <PublicShell>
      <div className="mx-auto max-w-md">
        <div className="mb-6 flex justify-center">
          <LogoDikey genislik={140} />
        </div>
        <div className="card">
          <h1 className="card-title">Personel girişi</h1>
          <div className="p-5">
            <LoginForm next={next ?? "/panel"} />
          </div>
        </div>

        {/*
          Uyarı kutusu ile hesap tablosu tek katlanır kutuda toplandı: ikisi
          birlikte telefonda sayfanın %39'unu (584 piksel) kaplıyordu, oysa
          giriş ekranına gelen kişi önce giriş kutusunu arıyor. Şifre açıkta
          kalır; gerisini merak eden açar.

          "DEMO_MODE=false yapın" cümlesi ekrandan çıkarıldı — giriş ekranına
          bakan kişiye değil, kurulumu yapana söylenecek bir şey.
        */}
        {demo && samples.length > 0 && (
          <details className="card mt-5">
            <summary className="cursor-pointer px-4 py-3 text-sm text-ink-700">
              <span className="font-medium">Demo modu</span> — tüm hesapların şifresi{" "}
              <code className="rounded bg-ink-100 px-1 py-0.5 text-xs font-semibold">Demo2026!</code>
              <span className="ml-1 text-ink-500">· örnek hesaplar ({samples.length})</span>
            </summary>
            <div className="border-t border-ink-200">
              <div className="table-wrap">
                <table className="tbl">
                  <thead>
                    <tr><th>Kullanıcı adı</th><th>Unvan</th><th>Birim</th></tr>
                  </thead>
                  <tbody>
                    {samples.map((s) => (
                      <tr key={s.username}>
                        <td className="font-mono text-xs">{s.username}</td>
                        <td>{s.title}</td>
                        <td className="text-ink-500">
                          {s.factory ?? ROLE_LABEL[s.role as Role] ?? "Genel Müdürlük"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="border-t border-ink-100 px-4 py-2.5 text-xs text-ink-500">
                14 fabrikanın her birinde 12 unvan tanımlı. Kullanıcı adı kalıbı:{" "}
                <code className="font-mono">fabrikakodu.unvan</code> (örnek{" "}
                <code className="font-mono">yoz.ambar</code>). Giriş sonrası üst menüden
                tek tıkla rol değiştirilebilir.
              </p>
            </div>
          </details>
        )}

        <p className="mt-5 text-center text-sm text-ink-500">
          Müşteri misiniz? <Link href="/sikayet/yeni" className="link">Şikâyet formuna gidin</Link>
        </p>
      </div>
    </PublicShell>
  );
}
