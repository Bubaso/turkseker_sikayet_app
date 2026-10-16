import type { Metadata } from "next";
import { PublicShell } from "@/components/public-shell";
import LookupForm from "./form";

export const metadata: Metadata = { title: "Şikâyet takibi" };

export default function TrackPage() {
  return (
    <PublicShell>
      <div className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight text-ink-900">Şikâyet takibi</h1>
        {/*
          Tek açıklama. Sayfadaki 48 kelimenin 42'si açıklamaydı ve "SMS" üç
          ayrı yerde geçiyordu: alt başlık, alan ipucu ve dipnot. Alanların
          etiketleri ne isteneceğini zaten söylüyor; geriye numarasını
          bulamayan için tek cümle kalıyor.
        */}
        <p className="mt-0.5 text-sm text-ink-600">
          Şikâyet numaranızı kayıt sonrası gönderilen SMS veya e-postada bulabilirsiniz.
        </p>
      </div>

      <div className="card-pad max-w-xl">
        <LookupForm />
      </div>

    </PublicShell>
  );
}
