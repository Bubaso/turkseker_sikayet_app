import Link from "next/link";
import { DIKKAT_BASLIK, type DikkatSatiri, type DikkatTuru } from "@/server/yonetim";
import { Card, Chip, EmptyState } from "@/components/ui";

const TON: Record<DikkatTuru, "danger" | "warn" | "brand" | "ink"> = {
  SLA_ASILDI: "danger",
  KRITIK_ACIK: "danger",
  ITIRAZ_SURESI: "warn",
  UZUN_SUREDIR_ACIK: "warn",
  TEKRAR_EDEN_URUN: "brand",
  TEKRAR_EDEN_MUSTERI: "brand",
};

/**
 * Dikkat gerektirenler. Üst yönetim bütün dosyaları gezmez; istisnaya bakar.
 * Satırlar ağırlığa göre sıralıdır ve her biri kendi listesine ya da dosyaya
 * götürür.
 */
export function DikkatKarti({
  satirlar, limit, tumuHref,
}: {
  satirlar: DikkatSatiri[];
  limit?: number;
  tumuHref?: string;
}) {
  const liste = limit ? satirlar.slice(0, limit) : satirlar;

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          Dikkat gerektirenler
          {satirlar.length > 0 && <Chip tone="danger">{satirlar.length}</Chip>}
        </span>
      }
      actions={
        tumuHref && satirlar.length > liste.length
          ? <Link href={tumuHref} className="btn btn-ghost btn-sm">Tümü →</Link>
          : undefined
      }
      bodyClass=""
    >
      {liste.length === 0 ? (
        <EmptyState
          title="Dikkat gerektiren bir durum yok"
          hint="Süresi aşılmış dosya, açık gıda güvenliği ihbarı ya da tekrar eden sorun bulunmuyor."
        />
      ) : (
        <ul className="divide-y divide-ink-100">
          {liste.map((d, i) => (
            <li key={`${d.tur}-${i}`}>
              <Link href={d.href}
                    className="flex flex-wrap items-start justify-between gap-2 px-4 py-2.5 hover:bg-brand-50/40 sm:px-5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink-800">{d.baslik}</p>
                  <p className="text-xs text-ink-500">{d.detay}</p>
                </div>
                <Chip tone={TON[d.tur]}>{DIKKAT_BASLIK[d.tur]}</Chip>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
