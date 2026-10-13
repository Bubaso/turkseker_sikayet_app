"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Notice } from "./ui";

/**
 * Sunucu eylemleri işlemi tamamladıktan sonra formu kapatabilir (örneğin imza
 * atıldığında imza paneli kaybolur). Bu durumda sonuç mesajı adres satırındaki
 * "m" parametresiyle taşınır ve burada gösterilir; gösterildikten sonra
 * parametre adres satırından temizlenir.
 */
export function FlashMessage() {
  const params = useSearchParams();
  const router = useRouter();
  const raw = params.get("m");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!raw) return;
    setMessage(raw);
    const next = new URLSearchParams(params.toString());
    next.delete("m");
    const qs = next.toString();
    router.replace(qs ? `${window.location.pathname}?${qs}` : window.location.pathname,
                   { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw]);

  if (!message) return null;
  return (
    <div className="mb-4">
      <Notice tone="ok" title="İşlem tamamlandı">
        {message}
        <button type="button" onClick={() => setMessage(null)}
                className="ml-2 cursor-pointer text-xs font-medium text-ink-600 underline">
          kapat
        </button>
      </Notice>
    </div>
  );
}
