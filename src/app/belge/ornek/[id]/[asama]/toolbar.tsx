"use client";

import Link from "next/link";

/**
 * Tutanak örneğinin üst çubuğu — çıktıda görünmez.
 *
 * Çubuk sayfanın ne olduğunu açıkça söyler: bu bir sistem belgesi değil,
 * doldurulacak bir kâğıttır. Kâğıdın kendisinde bu uyarı yoktur; yazdırılıp
 * imzalanan nüsha kurumun tutanağıdır.
 */
export function OrnekToolbar({ complaintId, baslik }: {
  complaintId: number;
  baslik: string;
}) {
  return (
    <div className="no-print mx-auto mb-4 w-[210mm] max-w-full px-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href={`/panel/sikayet/${complaintId}`} className="btn btn-secondary btn-sm">
          ← Dosyaya dön
        </Link>
        <span className="text-xs text-ink-600">{baslik} — örnek</span>
        <button type="button" onClick={() => window.print()} className="btn btn-primary btn-sm">
          Yazdır / PDF olarak kaydet
        </button>
      </div>
      <p className="mt-2 rounded-[5px] border border-warn-200 bg-warn-50 px-3 py-2 text-xs leading-relaxed text-warn-700">
        Bu bir <strong>örnektir</strong>: dosyanın bilinen bilgileri doldurulmuş, geri kalanı
        elle doldurulmak üzere boş bırakılmıştır. Yazdırıp tamamlayabilir ve imzalatabilir ya
        da hiç kullanmadan kendi belgenizi yükleyebilirsiniz. Aşamayı kapatan şey, yüklenen
        ıslak imzalı nüshadır; bu sayfa dosyaya kendiliğinden eklenmez.
      </p>
    </div>
  );
}
