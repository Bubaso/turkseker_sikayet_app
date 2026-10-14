"use client";

import Link from "next/link";

/** Yazdırma çubuğu — çıktıda görünmez. */
export function PrintToolbar({
  complaintId, docNo, geriHref, geriEtiket,
}: {
  complaintId: number;
  docNo: string;
  /** Dosya dışı çıktılarda (ör. yönetim özeti) dönülecek sayfa. */
  geriHref?: string;
  geriEtiket?: string;
}) {
  return (
    <div className="no-print mx-auto mb-4 flex w-[210mm] max-w-full flex-wrap items-center justify-between gap-2 px-4">
      <Link href={geriHref ?? `/panel/sikayet/${complaintId}?sekme=belgeler`}
            className="btn btn-secondary btn-sm">
        ← {geriEtiket ?? "Dosyaya dön"}
      </Link>
      <span className="text-xs text-ink-600">
        Belge no: <span className="font-mono">{docNo}</span>
      </span>
      <button type="button" onClick={() => window.print()} className="btn btn-primary btn-sm">
        Yazdır / PDF olarak kaydet
      </button>
    </div>
  );
}
