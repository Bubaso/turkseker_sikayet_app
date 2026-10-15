/* ===========================================================================
   Panel menüsünün tanımı.

   Menü iki yerde çizilir: geniş ekranda sabit kenar çubuğu, dar ekranda
   başlıktan açılan çekmece. İkisi de buradan beslenir; madde eklemek ya da
   bir maddeyi role göre gizlemek tek yerde yapılır.
   =========================================================================== */

export interface MenuMaddesi {
  href: string;
  label: string;
  count?: number;
  tone?: "danger" | "warn";
  show?: boolean;
}

export interface MenuGrubu {
  title: string;
  items: MenuMaddesi[];
}

export interface MenuSayaclari {
  open: number;
  overdue: number;
  myTasks: number;
  escalations: number;
  yazilar: number;
}

export interface MenuArgumanlari {
  gm: boolean;
  /** Menünün hangi kademeye göre kurulacağı. */
  kademe: "fabrika" | "ustyonetim" | "daire";
  counts: MenuSayaclari;
  canManageDefs: boolean;
  canSeeNotifications: boolean;
}

/**
 * Kademeye göre menüyü kurar. Genel Müdürlük tarafı izleyicidir: gösterge
 * paneli bütün ölçüleri taşıdığı için ayrı rapor, karşılaştırma ve dikkat
 * ekranı yoktur; geriye dosya listesi ile dairenin kendi işleri kalır.
 * Daire Başkanının karar kuyruğu ve resmî yazı kutusu öne çıkar.
 *
 * Gösterilmeyecek maddeler burada ayıklanır; çizen taraf boş grup görmez.
 */
export function panelMenusu({
  gm, kademe, counts, canManageDefs, canSeeNotifications,
}: MenuArgumanlari): MenuGrubu[] {
  const daire = kademe === "daire";

  const gruplar: MenuGrubu[] = gm
    ? [
        {
          title: "Gözetim",
          items: [
            { href: "/panel", label: "Gösterge paneli" },
            { href: "/panel/sikayetler", label: "Şikâyet dosyaları", count: counts.open },
          ],
        },
        {
          title: daire ? "Daire Başkanlığı" : "Çıktı",
          items: [
            {
              href: "/panel/itirazlar",
              label: "Kararımı bekleyenler",
              count: counts.escalations,
              tone: "warn",
              show: daire,
            },
            {
              href: "/panel/resmi-yazilar",
              label: "Resmî yazılar",
              count: counts.yazilar,
              tone: "warn",
              show: daire,
            },
            { href: "/panel/ozet", label: "Yönetim özeti" },
            { href: "/panel/tanimlar", label: "Tanımlar ve ayarlar", show: canManageDefs },
          ],
        },
      ]
    : [
        {
          title: "Günlük iş",
          items: [
            { href: "/panel", label: "Gösterge paneli" },
            {
              href: "/panel/gorevler",
              label: "Bana düşen aşamalar",
              count: counts.myTasks,
              tone: "warn",
            },
            { href: "/panel/sikayetler", label: "Şikâyet dosyaları", count: counts.open },
            {
              href: "/panel/sikayetler?gecikme=1",
              label: "Geciken dosyalar",
              count: counts.overdue,
              tone: "danger",
            },
            { href: "/panel/takvim", label: "Takvim" },
          ],
        },
        {
          title: "Süreç",
          items: [
            { href: "/panel/bildirimler", label: "SMS / e-posta giden kutusu", show: canSeeNotifications },
            { href: "/panel/raporlar", label: "Performans panosu" },
          ],
        },
        {
          title: "Yönetim",
          items: [
            { href: "/panel/sikayetler/yeni", label: "Elden şikâyet kaydet" },
            { href: "/panel/tanimlar", label: "Tanımlar ve ayarlar", show: canManageDefs },
          ],
        },
      ];

  return gruplar
    .map((g) => ({ ...g, items: g.items.filter((i) => i.show !== false) }))
    .filter((g) => g.items.length > 0);
}

/**
 * Bir menü maddesi bulunulan sayfayı mı gösteriyor?
 *
 * "Geciken dosyalar" ile "Şikâyet dosyaları" aynı yola bakıp sorgu
 * parametresiyle ayrıldığı için yalnızca yola bakmak yetmez.
 */
export function menuAktifMi(href: string, path: string, deger: (k: string) => string | null,
                            varMi: (k: string) => boolean): boolean {
  const [base, query] = href.split("?") as [string, string | undefined];
  if (query) {
    const [k, v] = query.split("=");
    return path === base && deger(k!) === v;
  }
  if (base === "/panel") return path === "/panel" && !varMi("gecikme");
  if (base === "/panel/sikayetler") return path === base && !varMi("gecikme");
  return path === base || path.startsWith(`${base}/`);
}

/** Sayaç rozetinin sınıfı. Borçlu olunan iş sarı, geciken kırmızı, düz sayım gri. */
export function sayacSinifi(tone: MenuMaddesi["tone"]): string {
  if (tone === "danger") return "bg-danger-50 text-danger-700";
  if (tone === "warn") return "bg-warn-50 text-warn-700";
  return "bg-ink-100 text-ink-600";
}
