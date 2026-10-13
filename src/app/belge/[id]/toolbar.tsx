"use client";

import Link from "next/link";

/** Yazdırma çubuğu — çıktıda görünmez. */
export function PrintToolbar({ complaintId, docNo }: { complaintId: number; docNo: string }) {
  return (
    <div className="no-print mx-auto mb-4 flex w-[210mm] max-w-full flex-wrap items-center justify-between gap-2 px-4">
      <Link href={`/panel/sikayet/${complaintId}?sekme=belgeler`} className="btn btn-secondary btn-sm">
        ← Dosyaya dön
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
