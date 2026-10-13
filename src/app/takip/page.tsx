import type { Metadata } from "next";
import { PublicShell } from "@/components/public-shell";
import LookupForm from "./form";

export const metadata: Metadata = { title: "Şikâyet takibi" };

export default function TrackPage() {
  return (
    <PublicShell>
      <div className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight text-ink-900">Şikâyet takibi</h1>
        <p className="mt-0.5 text-sm text-ink-600">
          Şikâyet numaranız ve cep telefonunuzun son 4 hanesiyle dosyanızın hangi aşamada
          olduğunu görebilirsiniz.
        </p>
      </div>

      <div className="card-pad max-w-xl">
        <LookupForm />
      </div>

      <p className="mt-4 max-w-xl text-xs leading-relaxed text-ink-500">
        Şikâyet numaranızı bulamıyorsanız, kayıt sırasında gönderilen SMS veya e-postadaki
        bağlantıyı kullanabilir ya da ürünü aldığınız şeker fabrikamızla iletişime geçebilirsiniz.
      </p>
    </PublicShell>
  );
}
