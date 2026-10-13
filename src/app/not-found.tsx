import Link from "next/link";
import { PublicShell } from "@/components/public-shell";

export default function NotFound() {
  return (
    <PublicShell>
      <div className="card-pad text-center">
        <h1 className="text-xl font-semibold text-ink-900">Sayfa bulunamadı</h1>
        <p className="mt-1.5 text-sm text-ink-600">
          Aradığınız kayıt bulunamadı veya bağlantının süresi geçmiş olabilir.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link href="/" className="btn btn-primary">Ana sayfa</Link>
          <Link href="/takip" className="btn btn-secondary">Şikâyet takibi</Link>
        </div>
      </div>
    </PublicShell>
  );
}
