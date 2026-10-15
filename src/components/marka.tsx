import Image from "next/image";

/* ===========================================================================
   Marka öğeleri.

   Logo dosyaları kurumun marka kılavuzundan (Logo.pdf, Logo_Dikey.pdf,
   Logo_Oran.pdf) çıkarılmıştır; yeniden çizilmemiş, vektörleri korunmuştur.
   Kılavuzun iki kuralı burada kodlanır:
     1. Logonun etrafında amblem yarıçapı kadar boşluk bırakılır.
     2. Koyu/yeşil zeminde yalnızca beyaz nüsha kullanılır.
   Oranlar dosyaların kendi viewBox'ından gelir; esnetme yapılmaz.
   =========================================================================== */

const YATAY_ORAN = 330 / 63.4;
const DIKEY = { w: 170.2, h: 177.3 };

/** Yatay kilit (amblem + kelime markası). Başlıklarda kullanılır. */
export function Logo({
  yukseklik = 28, beyaz = false, className = "",
}: {
  yukseklik?: number;
  beyaz?: boolean;
  className?: string;
}) {
  return (
    <Image
      src={beyaz ? "/marka/turkseker-logo-beyaz.svg" : "/marka/turkseker-logo.svg"}
      alt="Türkşeker"
      width={Math.round(yukseklik * YATAY_ORAN)}
      height={yukseklik}
      priority
      className={className}
    />
  );
}

/** Dikey kilit. Giriş ekranı gibi ortalanmış yerlerde kullanılır. */
export function LogoDikey({
  genislik = 150, beyaz = false, className = "",
}: {
  genislik?: number;
  beyaz?: boolean;
  className?: string;
}) {
  return (
    <Image
      src={beyaz ? "/marka/turkseker-logo-dikey-beyaz.svg" : "/marka/turkseker-logo-dikey.svg"}
      alt="Türkşeker"
      width={genislik}
      height={Math.round((genislik * DIKEY.h) / DIKEY.w)}
      priority
      className={className}
    />
  );
}

/** Yalnızca amblem. Dar yerlerde ve simge olarak kullanılır. */
export function Amblem({
  boyut = 32, beyaz = false, className = "",
}: {
  boyut?: number;
  beyaz?: boolean;
  className?: string;
}) {
  return (
    <Image
      src={beyaz ? "/marka/turkseker-amblem-beyaz.svg" : "/marka/turkseker-amblem.svg"}
      alt=""
      width={boyut}
      height={boyut}
      aria-hidden
      className={className}
    />
  );
}
