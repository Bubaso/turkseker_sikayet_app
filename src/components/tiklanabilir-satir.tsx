"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

/* ===========================================================================
   Tablo satırının tamamını dosyaya götüren sarmalayıcı.

   Listede dosyayı açmak için satırdaki küçük şikâyet numarasına nişan almak
   gerekiyordu; oysa kullanıcı satırın herhangi bir yerine tıklıyor. Satırın
   tamamı artık hedef.

   Neden ::after ile uzatılmış bağlantı değil de tıklama olayı: satırın üstüne
   şeffaf bir katman sermek, kırpılmış müşteri adı ve konu hücrelerindeki
   title ipuçlarını ve metin seçimini öldürüyordu. Tıklama olayı ikisini de
   yerinde bırakır.

   Satırın kendisi odaklanabilir yapılmadı: klavyeyle gezen kullanıcı için
   satırdaki şikâyet numarası zaten gerçek bir bağlantı. Satıra ayrıca
   tabIndex vermek, her satırda ikinci bir duraktan başka bir şey üretmezdi.
   =========================================================================== */

export function TiklanabilirSatir({
  href, children, className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  const router = useRouter();

  return (
    <tr
      className={`cursor-pointer ${className}`}
      onClick={(e) => {
        /*
         * Hücre içindeki gerçek bağlantı ya da düğme kendi işini yapsın:
         * şikâyet numarası bağlantısı, ileride eklenecek satır içi eylemler.
         */
        if ((e.target as HTMLElement).closest("a, button, input, select, label")) return;

        // Kullanıcı metin seçiyorsa (kopyalamak için) gezinme.
        if (window.getSelection()?.toString()) return;

        // Ctrl/Cmd + tıklama ya da orta tuş: yeni sekmede aç.
        if (e.metaKey || e.ctrlKey) window.open(href, "_blank", "noopener");
        else router.push(href);
      }}
    >
      {children}
    </tr>
  );
}
