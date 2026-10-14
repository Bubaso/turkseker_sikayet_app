# Türkşeker Müşteri Şikâyet Takip Sistemi

Türkiye Şeker Fabrikaları A.Ş.'nin 14 şeker fabrikası ve Genel Müdürlük daire
başkanlıkları için müşteri şikâyetlerinin kaydı, incelenmesi, karara bağlanması
ve raporlanmasını uçtan uca yürüten kurumsal uygulama.

Süreç **TL PASAT 004 "Müşteri Şikâyetlerinde Uygulamalar"** talimatına uyacak
şekilde modellenmiştir. Uygulama belge üretmez: tutanak, analiz raporu ve resmî
yazı fabrikada hazırlanıp imzalanır, sisteme yalnızca sonuç belgesi yüklenir.
Uygulamanın işi, her kilometre taşının ne zaman, kim tarafından ve hangi
belgeyle kayda geçtiğini tutmak ve süreci izlenebilir kılmaktır.

---

## İçindekiler

- [Hızlı başlangıç](#hızlı-başlangıç)
- [Sorun giderme](#sorun-giderme)
- [Demo hesapları](#demo-hesapları)
- [Sistemin kapsadığı süreç](#sistemin-kapsadığı-süreç)
- [Modüller](#modüller)
- [Mimari](#mimari)
- [Yapılandırma](#yapılandırma)
- [Canlıya geçiş adımları](#canlıya-geçiş-adımları)
- [Türkşeker sitesine entegrasyon](#türkşeker-sitesine-entegrasyon)
- [Testler](#testler)
- [Talimattan sapmalar ve eklemeler](#talimattan-sapmalar-ve-eklemeler)

---

## Hızlı başlangıç

**Gereksinim: yalnızca Node.js 22.13+ veya 24 LTS.** Başka hiçbir şey kurmanız
gerekmez — veritabanı sunucusu, Docker, Python, Visual Studio Build Tools yok.
Veri tek bir SQLite dosyasında tutulur ve Node'un **yerleşik** SQLite desteği
kullanılır; bu nedenle projede derlenmesi gereken hiçbir bileşen yoktur.

> **Windows kullanıcıları — önemli:** Projeyi `C:\Windows\System32` veya
> `C:\Program Files` gibi korumalı sistem klasörlerine **klonlamayın**. Bu
> klasörlere yazma izni olmadığı için kurulum `EPERM` hatalarıyla başarısız olur.
> Kendi kullanıcı klasörünüzü kullanın.

### Windows (Komut İstemi veya PowerShell)

```bat
cd %USERPROFILE%
git clone https://github.com/Bubaso/turkseker_sikayet_app
cd turkseker_sikayet_app
npm install
npm run kurulum
npm run dev
```

### macOS / Linux

```bash
cd ~
git clone https://github.com/Bubaso/turkseker_sikayet_app
cd turkseker_sikayet_app
npm install
npm run kurulum
npm run dev
```

`npm run kurulum` komutu Node sürümünü doğrular, korumalı dizin kontrolü yapar,
`.env.local` dosyasını rastgele bir oturum anahtarıyla oluşturur, veri
klasörlerini açar ve referans verisini (14 fabrika, 81 il, ürünler, kategoriler,
175 kullanıcı) yükler. Windows, macOS ve Linux'ta aynı şekilde çalışır.

Ardından tarayıcıda:

1. `http://localhost:3000` — müşteri karşılama sayfası
2. `http://localhost:3000/giris` — personel girişi (`sistem` / `Demo2026!`)
3. **Tanımlar → Demo Verisi** ekranından örnek şikâyet üretin; panolar ve
   raporlar o anda anlamlı veriyle dolar.

Veritabanını sıfırlamak için `npm run db:reset` (tüm şikâyet verisi silinir,
referans tanımlar yeniden yüklenir).

### Kurumsal ağ arkasında kurulum

Türkşeker gibi kurumsal ağlarda TLS trafiği bir güvenlik cihazı tarafından
kesilir ve sertifikalar değiştirilir. Bu, `self-signed certificate in
certificate chain` hatalarına yol açar.

Bu uygulama **yalnızca npm kayıt defterinden (`registry.npmjs.org`)** paket
indirir; `nodejs.org` veya `github.com` üzerinden ikili dosya indiren hiçbir
bağımlılık yoktur. npm kayıt defterine erişebiliyorsanız kurulum sorunsuz
tamamlanır.

npm kayıt defterine de erişemiyorsanız, kurumsal kök sertifikanızı npm'e
tanıtın (tercih edilen yöntem):

```bat
npm config set cafile "C:\yol\kurumsal-kok-sertifika.pem"
```

### Sorun giderme

| Hata | Sebep ve çözüm |
|---|---|
| `EPERM: operation not permitted` | Proje korumalı bir sistem klasöründe. `%USERPROFILE%` altına taşıyın. |
| `self-signed certificate in certificate chain` | Kurumsal TLS kesmesi. Yukarıdaki `npm config set cafile` adımını uygulayın. |
| `Cannot find package 'better-sqlite3'` | Eski bir sürümden kalma. `npm install` komutunu yeniden çalıştırın; bu paket artık kullanılmıyor. |
| `node:sqlite bulunamadı` / `DatabaseSync is not a function` | Node.js sürümünüz eski. 22.13+ veya 24 LTS kurun: https://nodejs.org |
| `'cp' is not recognized` | Windows'ta `cp` yoktur. `npm run kurulum` komutu bu işi sizin yerinize yapar. |
| Port 3000 dolu | `npm run dev -- -p 3001` ile başka port kullanın. |

## Demo hesapları

Tüm demo hesaplarının şifresi: **`Demo2026!`**

Kullanıcı adı kalıbı `fabrikakodu.unvan` şeklindedir. 14 fabrikanın her birinde
12 unvan tanımlıdır:

| Unvan eki | Rol | Unvan eki | Rol |
|---|---|---|---|
| `mudur` | Fabrika Müdürü | `ambar` | Ambar Şefi |
| `myteknik` | Müdür Yrd. (Teknik) | `satis` | Satış Birim Şefi |
| `myziraat` | Müdür Yrd. (Ziraat) | `lab` | Laboratuvar Sorumlusu |
| `myidari` | Müdür Yrd. (İdari) | `muhasebe` | Muhasebe Yetkilisi |
| `kalitemy` | Kalite ve İşl. Kontrol Md. Yrd. | `ziraat` | Ziraat Yetkilisi |
| `kalite` | Kalite Sorumlusu | `teknik` | Teknik (İşletme) Yetkilisi |

Fabrika kodları: `AGR` `ANK` `BUR` `ELZ` `ERC` `ERG` `ESK` `ILG` `KRS` `KAS`
`MLT` `SUS` `USK` `YOZ`

Örnek: `ank.mudur`, `yoz.ambar`, `kas.lab`, `erg.kalitemy`

**Genel Müdürlük hesapları**

| Kullanıcı adı | Unvan |
|---|---|
| `gm.genelmudur` | Genel Müdür Yardımcısı — tüm fabrikaları görür |
| `gm.pazarlama` | Pazarlama ve Satış Daire Başkanı — itiraz kararı verir |
| `gm.perakende` | Perakende Satışlar ve Lojistik Daire Başkanı — itiraz kararı verir |
| `gm.uretim` | Şeker Üretim Daire Başkanı |
| `gm.maliisler` | Mali İşler ve Muhasebe Daire Başkanı |
| `gm.strateji` | Strateji Geliştirme Daire Başkanı |
| `sistem` | Sistem Yöneticisi — tanımlar ve demo verisi |

### Rol değiştirici

`DEMO_MODE=true` iken panelin üst çubuğunda **Rol değiştir** menüsü çıkar.
Menü iki sekmelidir:

- **Fabrika** — önce fabrika seçersiniz, sonra o fabrikanın 12 unvanı listelenir
- **Genel Müdürlük** — Genel Müdür Yardımcısı, 5 Daire Başkanı ve Sistem Yöneticisi

Menü, oturumdaki kullanıcının kadrosuyla açılır: fabrika personeliyseniz kendi
fabrikanız seçili gelir, Genel Müdürlük kullanıcısıysanız o sekme açılır. Şifre
sormadan tek tıkla geçiş yaparsınız; 11 adımlı süreci baştan sona göstermek için
tasarlanmıştır.

Canlıya geçerken `DEMO_MODE=false` yapıldığında bu menü tamamen kaybolur ve
sunucu tarafında rol değiştirme reddedilir.

---

## Sistemin kapsadığı süreç

Uygulama **belge üretmez.** Tutanak, analiz raporu, resmî yazı ve müşteri
bilgilendirmesi fabrikada hazırlanır, elle imzalanır ve yalnızca sonuç belgesi
sisteme yüklenir. Uygulamanın işi, her kilometre taşının **ne zaman, kim
tarafından ve hangi belgeyle** kayda geçtiğini tutmak ve süreci izlenebilir
kılmaktır.

Dosyada en çok sekiz aşama vardır (`src/lib/asamalar.ts`):

| # | Aşama | Nasıl kapanır | Süre (iş günü) | Sorumlu | Dayanak |
|---|---|---|---|---|---|
| 1 | Şikâyet kaydı + Müşteri Şikâyet Formu (FR PASAT 007) | kayıtla birlikte otomatik | 0 | Fabrika / müşteri | md. 1 |
| 2 | İnceleme ekibini oluştur **veya** daha yakın fabrikaya yönlendir | ekip kutularından | ≤ 1 | Fabrika Müdürü | md. 2-3 |
| 3 | İnceleme ve analiz belgelerini yükle | **belge** | ≤ 3 | Ekip lideri | md. 4 |
| 4 | Kararı ve imzalı tutanağı yükle | **belge** + haklı/haksız | ≤ 3 | Ekip lideri | md. 4 |
| 5 | Haksız + eşik aşımı → itirazı Daire Başkanlığına gönder | **belge** | — | Fabrika Müdürü | md. 5 |
| 6 | Daire Başkanlığı kararını kaydet | **belge** + kabul/ret | ≤ 5 | İlgili daire | md. 5 |
| 7 | İade / değişim ve nakliye belgelerini yükle | **belge** | ≤ 5 | Ambar Şefi | md. 6 |
| 8 | Resmî yazıyı ve müşteri bilgilendirmesini yükle | **belge** | işlemden ≤ 3 | Kalite Sorumlusu | md. 6-7 |
| 9 | Dosyayı kapat | kapanış notuyla | — | Fabrika Müdürü | md. 8 |
| — | Aylık Müşteri Şikâyetleri Tablosu | aylık | aylık | Fabrika | md. 8 |

İtiraz dalı yalnızca şikâyet haklı bulunmadığında ve miktar eşiği aşıldığında
açılır; haklı dosyalarda 5-6 numaralı aşamalar hiç oluşmaz. Dosyada bulunmayan
bir öncül sağlanmış sayıldığı için üç dal (haklı / haksız / itiraz) tek bir
bağımlılık grafiğiyle yürür.

**Tüm süreler iş günü bazlıdır.** Hafta sonları ve Tanımlar sayfasında kayıtlı
resmî tatiller hesaba katılmaz.

### İmza süreci fabrikada elle yürür

Talimatın öngördüğü altı imzalı zincir (Ambar Şefi → Satışı Yapan Birim Şefi →
Kalite ve İşl. Kontrol Md. Yrd. → Fabrika Müdür Yrd. → Fabrika Müdür Yrd.
(İdari) → onay: Fabrika Müdürü) **uygulamada yürütülmez.** Tutanak fabrikada
hazırlanır, ıslak imzalar toplanır ve imzaları tamamlanmış son nüsha "Kararı ve
imzalı tutanağı yükle" aşamasında sisteme yüklenir. Sistem belgenin kim
tarafından, hangi tarihte kayda geçirildiğini saklar; imza satırlarını kendisi
üretmez.

Böylece uygulama, fabrikanın gerçek iş akışına paralel ikinci bir onay süreci
işletmek yerine, o akışın sonucunu kayda geçiren bir izleme aracı olur.

### İtiraz eşikleri (md. 5)

Şikâyet haklı bulunmadığında, şikâyete konu miktar aşağıdaki eşikleri aşıyorsa
dosya ilgili Daire Başkanlığına gönderilir:

| Ürün | Eşik | Karar mercii |
|---|---|---|
| Şeker (dökme/çuvallı) | ≥ 50 ton | Pazarlama ve Satış Daire Başkanlığı |
| Paketli şeker | ≥ 50 ton | **Perakende Satışlar ve Lojistik** Daire Başkanlığı |
| Paketli posa | ≥ 1.000 ton | Pazarlama ve Satış Daire Başkanlığı |
| Melas | ≥ 30 ton | Pazarlama ve Satış Daire Başkanlığı |

### Müşteriye giden bildirimler

Her kilometre taşında SMS ve e-posta gönderilir: doğrulama kodu, kayıt alındı,
ekip oluşturuldu, yönlendirildi, inceleme yapıldı, karar (haklı / haklı
bulunmadı), Genel Müdürlük değerlendirmesi başladı / sonuçlandı, iade-değişim
tamamlandı, dosya kapandı.

SMS metinlerinde Türkçe özel karakterler varsayılan olarak ASCII karşılıklarına
çevrilir. Sebep: GSM-7 alfabesi `ş ğ ı İ` içermez; bu karakterler mesajı UCS-2'ye
düşürür ve segment başına 160 yerine 70 karakter alınır, yani SMS maliyeti iki
katına çıkar. Bu davranış **Tanımlar → Ayarlar → SMS'lerde Türkçe karakter**
ile değiştirilebilir.

---

## Modüller

**Müşteri tarafı (giriş gerektirmez)**
- 4 adımlı şikâyet formu — başvuru sahibi, ürün, şikâyet, KVKK + SMS doğrulama
- Kanıt dosyası yükleme (görsel, PDF, Word, Excel)
- Takip sayfası: şikâyet no + telefonun son 4 hanesi, ya da SMS'teki bağlantı
- Süreç adımları, kalan süreler ve gönderilen tüm bilgilendirmeler

**Fabrika paneli**
- Gösterge paneli, şikâyet dosyaları (filtre/arama/SLA renk kodu), bana düşen
  aşamalar
- **Şikâyet dosyası tek sayfadır:** en üstte müşterinin doldurduğu formun
  kendisi, hemen altında dosyanın aşamaları, sonra bütün ekler ve geçmiş.
  Sekme yoktur.
- Ekip kurma düzeneği: kaç kişi olacağı seçilir, o kadar kişi kutusu belirir,
  her kutuda unvan (fabrika kadrosundan) ve isim seçilir
- Aşama kaydı: tarih + kısa açıklama + **belge**. Belge uygulamada üretilmez,
  dışarıda hazırlanıp yüklenir
- Yakın fabrikaya yönlendirme, aşama sorumlusunu değiştirme, gerekmeyen aşamayı
  atlama, dosyayı kapatma ve iptal etme
- Takvim: aşama son tarihleri, resmî tatiller, yeni şikâyetler
- Elden / telefonla gelen şikâyetlerin personel tarafından kaydı

**Genel Müdürlük paneli** — işlevi süreci izlemektir
- Role göre ayrışan gösterge paneli (üst yönetim / daire başkanlığı)
- 14 fabrikanın tüm dosyaları: hangi fabrikada kaç şikâyet, hangi aşamada
- Dikkat gerektirenler: tekrarlayan ürün/müşteri, SLA aşımı, kritik dosyalar
- Fabrika karşılaştırma, dönem kıyası ve 12 aylık trendler
- Daire bazında itiraz kuyruğu ve karar verme (5 iş günü sayacıyla)
- Daire Başkanlıklarına gelen resmî yazılar kutusu
- SMS / e-posta giden kutusu, hatalı gönderimleri yeniden deneme
- A4 yönetim özeti çıktısı

**Raporlama**
- Performans panosu: SLA uyum oranı, ortalama kapanma süresi, haklı bulunma
  oranı, 14 fabrika karşılaştırması, 12 aylık trend, kategori ve ürün grubu
  dağılımı, kilometre taşı bazında süre uyumu
- FR PASAT 005 Aylık Müşteri Şikâyetleri Tablosu — 17 kolonuyla ekranda ve
  Excel çıktısı olarak (devreden dosyalar işaretli, aylık işlem toplamı,
  gönderim dağıtımı ve imza alanı dâhil)

**Belge**

Uygulamanın ürettiği tek belge **FR PASAT 007 Müşteri Şikâyet Formu**'dur:
müşterinin beyanının kaydıdır, kayıtla birlikte otomatik oluşur ve dosyayı açan
personelin ilk gördüğü şeydir. A4 yerleşiminde ekranda açılır; tarayıcının
**Yazdır → PDF olarak kaydet** seçeneğiyle PDF üretilir.

Diğer bütün belgeler (inceleme tutanağı, analiz raporu, karar tutanağı, üst
yazı, irsaliye, dekont, resmî yazı, müşteri bilgilendirmesi) fabrikada
hazırlanır ve ilgili aşamanın kayıt formundan yüklenir. Her ek, hangi aşamanın
belgesi olduğunu kendi üzerinde taşır ve o aşamanın kutusunda görünür.

---

## Mimari

| Katman | Teknoloji | Not |
|---|---|---|
| Arayüz | Next.js 15 (App Router), React 19, TypeScript | Sunucu bileşenleri + Server Actions |
| Stil | Tailwind CSS v4 | Tek vurgu rengi, gölgesiz, yoğun veri tablolarına uygun |
| Veritabanı | SQLite — Node yerleşik `node:sqlite` | Tek dosya, derleme gerektirmez; PostgreSQL'e taşınabilir |
| Excel | ExcelJS | Saf JS, yerel bağımlılık yok |
| Grafikler | Satır içi SVG | Harici grafik kütüphanesi yok |
| Oturum | HMAC imzalı httpOnly çerez + sunucu tarafı oturum kaydı | |
| Şifre | scrypt | |

### Kaynak düzeni

```
src/
  app/                      sayfalar ve sunucu eylemleri
    page.tsx                karşılama
    sikayet/yeni/           halka açık şikâyet formu
    takip/                  müşteri takip sayfaları
    giris/                  personel girişi
    panel/                  tüm yönetim ekranları
      actions.ts            sunucu eylemleri (tek aşama eylemi: asamaAction)
      sikayet/[id]/         dosya sayfası: form + ekip düzeneği + aşamalar
        page.tsx            tek sayfa, sekme yok
        surec.tsx           aşama listesi ve kayıt formları
        ekip-kur.tsx        kişi sayısı → unvan + isim kutuları
        ekler.tsx           bütün ekler (katlanır)
        gecmis.tsx          denetim izi ve bildirimler (katlanır)
      panolar/              role göre gösterge panoları
    belge/[id]/             Müşteri Şikâyet Formu çıktısı (A4)
    api/ek/[id]/            yetkili dosya servisi
    api/rapor/aylik/        Excel çıktısı
  components/               ortak arayüz bileşenleri, grafikler
    sikayet-formu.tsx       FR PASAT 007 — panelde ve yazdırmada ortak
    surec-seridi.tsx        müşteri süreç şeridi — ana sayfa ve takip sayfası ortağı
  lib/
    db/schema.sql           veritabanı şeması (19 tablo)
    db/driver.ts            node:sqlite sürücü katmanı (işlem, SAVEPOINT, parametre normalleştirme)
    db/index.ts             bağlantı ve sorgu yardımcıları
    domain.ts               durumlar, talepler, ek türleri, SLA günleri
    asamalar.ts             aşama kataloğu, öncüller, dalların açılması
    esik.ts                 itiraz eşiği ve daire yönlendirmesi
    dates.ts                iş günü ve SLA hesapları
    roles.ts                roller ve yetki matrisi
  server/                   iş mantığı (sunucuya özel)
    asama.ts                süreç motoru — tek giriş noktası: asamayiKaydet()
    asamalar-db.ts          aşama satırları, görünümler, atama
    complaints.ts           kayıt oluşturma ve sorgular
    documents.ts            Müşteri Şikâyet Formu
    attachments.ts          dosya saklama ve ek kayıtları
    notify.ts               bildirim şablonları ve gönderim
    providers.ts            SMS / e-posta sağlayıcı adaptörleri
    stats.ts                performans istatistikleri
    yonetim.ts              Genel Müdürlük gözetim sorguları
    monthly.ts              FR PASAT 005 aylık tablo
    demo.ts                 demo verisi üreticisi
scripts/
  kurulum.mjs               tek komutluk kurulum (çapraz platform)
  seed.mjs                  referans verisi yükleyici
  reset-db.mjs              veritabanı sıfırlama
  lib/db.mjs                sürücünün betikler için düz JS karşılığı
tests/
  surucu.mjs                sürücü davranış testi (işlem, SAVEPOINT, tip dönüşümleri)
  senaryo.mjs               uçtan uca senaryo testi
  sahiplik.mjs              tek sorumlu ve sıra kuralı testi
  lib/tarayici.mjs          testlerin Playwright çözümlemesi
```

### Müşteriye gösterilen süreç

Ana sayfadaki "Şikâyetiniz nasıl ilerler?" bölümü ile müşteri takip sayfasındaki
"Süreç adımları" şeridi **aynı bileşeni** (`src/components/surec-seridi.tsx`) ve
aynı başlık sözlüğünü kullanır. Müşteri başvurmadan önce gördüğü resmi,
başvurduktan sonra takip sayfasında tanır; tek fark adımların durumudur:

- **Ana sayfa** — bütün adımlar nötr, yanlarında tahmini süre (`1. iş günü`,
  `3. iş günü`…). Sonuç adımı iki çıkışı birlikte gösterir: şikâyet haklı
  bulunursa iade/değişim, bulunmazsa gerekçeli bildirim ve miktar eşiği
  aşılmışsa Genel Müdürlük değerlendirmesi.
- **Takip sayfası** — tamamlanan adımlar yeşil onay işaretli ve gerçekleşme
  tarihli, koşulu oluşmayan adımlar (ör. analiz gerekmedi) atlanmış olarak
  işaretli.

Telefonda adım açıklamaları varsayılan olarak kapalıdır; tek düğmeyle açılır.

Metinlerde **kurum iç işleyişi yer almaz**: hangi unvanın ne yaptığı, tutanak,
imza zinciri, Daire Başkanlıklarına raporlama gibi ayrıntılar müşteriyi
ilgilendirmediği için yazılmaz. Her cümle müşterinin başına geleni anlatır
("Şikâyetinizin haklı bulunup bulunmadığı karara bağlanır ve sonuç size SMS ile
bildirilir"). Bu ölçüt halka açık üç sayfanın tamamı için geçerlidir: karşılama,
şikâyet formu ve takip sayfası. Altbilgide de yalnızca telif ve KVKK satırı
durur; talimat numarası yer almaz.

Talimat maddeleri (`TL PASAT 004 md. …`) yalnızca **personel panelinde** form ve
ekranların altında dayanak olarak gösterilir.

### Dosya sayfası: önce form, sonra aşamalar

Dosyayı açan kişinin ilk gördüğü şey **müşterinin doldurduğu formun kendisidir**
(FR PASAT 007 düzeninde, alan alan). Hemen altında dosyanın aşamaları durur:
sırası gelen aşama kayıt formunu açar, kapanmış aşama tarihini, kaydedeni ve
yüklenen belgeyi gösterir, sırası gelmemiş aşama neyi beklediğini yazar.

Sekme yoktur. Bütün ekler ve denetim izi sayfanın altında katlanmış durur;
günlük işte gerekmediği için akışı bölmez.

Yeni bir şikâyet Fabrika Müdürünün ekranına düştüğünde formun altında **ekip
kurma düzeneği** çıkar: müdür ekibin kaç kişi olacağını seçer, o kadar kişi
kutusu belirir, her kutuda önce unvan (fabrikanın kadrosundan otomatik
listelenir), sonra o unvandaki isim seçilir. İlk sıradaki kişi ekip lideridir;
inceleme ve karar aşamaları ona düşer.

### Tek sorumlu ve sıra kuralı

Sistemin temel kuralı: **her aşama tek bir kişinin üzerindedir ve aşamalar
sırayla kapanır.**

Bir aşamayı kaydedebilmek için şu koşullar birlikte sağlanmalıdır
(`src/server/asama.ts` — `asamaYetkisi`):

1. Kullanıcı dosyanın fabrikasına erişebiliyor,
2. aşama bu dosyada açık ve daha önce kapatılmamış,
3. öncül aşamaların tamamı kapanmış (sırası gelmiş),
4. işlemi yapan kişi aşamanın sorumlusu **ya da** Fabrika Müdürü — iş fabrikada
   elle yapıldığı için kaydı sorumlunun yerine müdürün girmesi de meşrudur ve
   her kayıt kimin girdiğini saklar.

Arayüz aynı kuralı gösterir: kayıt formu yalnızca sırası gelmiş ve kendisine
düşen aşamada çıkar. Diğer personel aşamayı görür ama formunu değil; aşamanın
kimin üzerinde olduğunu okur. Sırası gelmemiş aşamada "Sırası gelmedi — önce şu
aşama tamamlanmalı" yazar. Sunucu tarafı, arayüz ne gösterirse göstersin kuralı
yeniden uygular.

Aşamaların sırası `src/lib/asamalar.ts` içindeki `oncul` alanlarında tanımlıdır.
**Dosyada bulunmayan öncül sağlanmış sayılır**; böylece haklı, haksız ve itiraz
dalları tek bir bağımlılık grafiğiyle yürür.

Bir aşama elle "tamamlandı" yapılamaz: belge isteyen aşama ancak belge
yüklenerek kapanır. Ekip kurma ve kapanış belge istemez; biri ekip kutularından,
diğeri kapanış notuyla kapanır.

**Fabrika Müdürünün rolü** süreci yürütmektir: şikâyeti ve formunu görür,
inceleme ekibini kurar ya da dosyayı daha yakın fabrikaya yönlendirir, bir
aşamanın sorumlusunu değiştirir (izin, rapor, görevden ayrılma hâllerinde),
koşulu oluşmayan aşamayı gerekçeyle atlar, gerektiğinde bir aşamanın kaydını
kendisi girer, itirazı Daire Başkanlığına gönderir ve dosyayı kapatır. Açık
aşama varken dosya kapatılamaz.

#### Diğer yetki kuralları

Yetki matrisi sadeleştirilmiştir (`src/lib/roles.ts`): bir aşamayı kimin
kaydedeceğini yetki değil, **aşamanın sorumlusu** belirler. Aşamalardan bağımsız
altı yetki kalır — şikâyet kaydetme, sorumlu değiştirme, dosya kapatma, itiraz
kararı, bildirim kutusu ve tanım yönetimi.

- Aşamaların varsayılan sorumlusu unvana göre atanır: inceleme ve karar ekip
  liderine, iade/değişim Ambar Şefine, resmî yazı Kalite Sorumlusuna, ekip
  kurma ve kapanış Fabrika Müdürüne, daire kararı ilgili Daire Başkanlığına
- Daire Başkanı yalnızca **kendi dairesine** düşen itirazı karara bağlar
- Fabrika personeli yalnızca **kendi fabrikasının** dosyalarını görür
- Genel Müdürlük tüm fabrikaları görür; işlevi süreci izlemektir, fabrika
  aşamalarını kaydetmez (istisna: kendi dairesinin itiraz kararı)
- Dosya başka fabrikaya yönlendirildiğinde açık aşamalar yeni fabrikanın aynı
  unvandaki personeline devrolur

---

## Yapılandırma

Tüm ayarlar `.env.local` dosyasındadır (`.env.example` dosyasını kopyalayın).

| Değişken | Varsayılan | Açıklama |
|---|---|---|
| `SESSION_SECRET` | — | Oturum çerezi imza anahtarı. **Canlıda mutlaka değiştirin.** |
| `DATABASE_PATH` | `./data/sikayet.db` | SQLite dosyası |
| `UPLOAD_DIR` | `./data/uploads` | Yüklenen dosyalar |
| `DEMO_MODE` | `true` | Rol değiştirici ve demo verisi üretimi. **Canlıda `false`.** |
| `APP_BASE_URL` | `http://localhost:3000` | SMS'lerdeki takip bağlantısı |
| `SMS_PROVIDER` | `simulasyon` | `simulasyon` \| `netgsm` \| `iletimerkezi` |
| `SMS_SENDER_TITLE` | `TURKSEKER` | Operatörde tanımlı gönderen başlığı |
| `MAIL_PROVIDER` | `simulasyon` | `simulasyon` \| `smtp` |

Uygulama içi ayarlar (**Tanımlar → Ayarlar**): halka açık formun açık/kapalı
olması, SMS doğrulamasının zorunluluğu, kod geçerlilik süresi, IP başına saatlik
kayıt sınırı, dosya boyutu sınırları, KVKK aydınlatma metni.

### Resmî tatil takvimi

İş günü hesaplarının tamamı `holidays` tablosunu kullanır. 2025-2027 resmî
tatilleri yüklü gelir. **Dinî bayram tarihleri astronomik hesaba göre ön
tanımlıdır**; Diyanet İşleri Başkanlığının resmî ilanından sonra
**Tanımlar → Resmî Tatil Takvimi** ekranından doğrulanmalıdır.

---

## Canlıya geçiş adımları

1. **Oturum anahtarını üretin**
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```
   Çıktıyı `SESSION_SECRET` değerine yazın.

2. **Demo modunu kapatın:** `DEMO_MODE=false`
   Rol değiştirici kaybolur, sunucu tarafında rol değiştirme reddedilir.

3. **Gerçek kullanıcıları tanımlayın.** Demo hesapları `is_demo = 1` ile
   işaretlidir; canlıya geçerken devre dışı bırakın:
   ```sql
   UPDATE users SET is_active = 0 WHERE is_demo = 1;
   ```
   Gerçek personeli kurum e-postalarıyla ekleyin. (Kurumda LDAP / Active
   Directory varsa `src/server/auth.ts` içindeki `login()` fonksiyonu bu
   doğrulamayı kullanacak şekilde değiştirilebilir.)

4. **SMS sağlayıcısını bağlayın**
   ```env
   SMS_PROVIDER=netgsm
   NETGSM_USERNAME=...
   NETGSM_PASSWORD=...
   SMS_SENDER_TITLE=TURKSEKER
   ```
   NetGSM ve İleti Merkezi adaptörleri hazırdır. Gönderen başlığının operatörde
   kurum adına tanımlı olması gerekir.

5. **E-posta sağlayıcısını bağlayın**
   ```bash
   npm install nodemailer
   ```
   ```env
   MAIL_PROVIDER=smtp
   SMTP_HOST=...
   SMTP_PORT=587
   SMTP_USER=...
   SMTP_PASSWORD=...
   MAIL_FROM=sikayet@turkseker.gov.tr
   ```

6. **Resmî tatil takvimini doğrulayın** (Tanımlar → Resmî Tatil Takvimi).

7. **KVKK aydınlatma metnini kurum hukuk biriminin onayladığı metinle
   değiştirin** (Tanımlar → Ayarlar).

8. **Yedekleme kurun.** Yedeklenmesi gerekenler: `data/sikayet.db` ve
   `data/uploads/` klasörü.

   Dosyayı doğrudan kopyalamak güvenli değildir: WAL kipinde yazılmamış veri
   `-wal` dosyasında bekler. Tutarlı yedek için uygulamanın kendi Node'uyla
   gelen SQLite kullanılır (ek araç kurulumu gerekmez):

   ```bash
   node --disable-warning=ExperimentalWarning -e "const{DatabaseSync}=require('node:sqlite');const d=new DatabaseSync('data/sikayet.db');d.exec(`VACUUM INTO 'yedek-sikayet.db'`);d.close();console.log('yedek alindi')"
   ```

   Windows'ta aynı komut Komut İstemi'nde de çalışır. Zamanlanmış yedek için bu
   satırı bir `.bat` dosyasına koyup Görev Zamanlayıcı ile günlük çalıştırın;
   `data/uploads/` klasörünü de standart dosya yedeklemesine dâhil edin.

9. **HTTPS arkasında yayına alın.** Oturum çerezi `NODE_ENV=production` iken
   `Secure` olarak işaretlenir; uygulamanın HTTPS üzerinden sunulması şarttır.

10. **Node.js sürümünü sabitleyin.** Uygulama Node'un yerleşik SQLite desteğini
    kullanır ve en az 22.13 gerektirir. Sunucuda LTS sürüm (22 veya 24) kullanın;
    `package.json` içindeki `engines` alanı bunu belirtir.

11. **Kurumsal ölçekte PostgreSQL'e geçiş.** Mevcut kullanım (14 fabrika, yılda
    birkaç yüz dosya) için SQLite fazlasıyla yeterlidir. Yüksek eşzamanlılık
    gerekirse `src/lib/db/index.ts` tek değişim noktasıdır; SQL'in tamamı
    standarttır, yalnızca `datetime('now')` ve `strftime` çağrıları PostgreSQL
    karşılıklarıyla değiştirilir.

---

## Türkşeker sitesine entegrasyon

Kurum sitesindeki **"Şikâyet Formu Doldur"** butonu doğrudan şu adrese
yönlendirilir:

```html
<a href="https://sikayet.turkseker.gov.tr/sikayet/yeni">Şikâyet Formu Doldur</a>
```

Sayfa kendi başına çalışır, kurumsal antet ve altbilgiyle gelir, oturum
gerektirmez. Formun kurum sitesine `<iframe>` ile gömülmesi gerekiyorsa
`next.config.ts` içindeki `headers()` bölümüne `/sikayet/:path*` yolu için
`Content-Security-Policy: frame-ancestors https://www.turkseker.gov.tr`
başlığı eklenmelidir.

Müşteri takibi için ikinci bir bağlantı:
```html
<a href="https://sikayet.turkseker.gov.tr/takip">Şikâyetimi Takip Et</a>
```

---

## Testler

```bash
npm run typecheck      # TypeScript tür kontrolü
npm run test:surucu    # SQLite sürücü davranış testi (21 kontrol, saniyeler sürer)
npm run build          # üretim derlemesi
```

`test:surucu` veritabanı sürücüsünün işlem semantiğini doğrular: commit,
rollback, iç içe SAVEPOINT kullanımı, hata yayılımı, parametre normalleştirme
(`undefined` → NULL, `boolean` → 0/1) ve satır nesnelerinin React Sunucu
Bileşeni uyumluluğu. Hiçbir harici bağımlılık gerektirmez.

**Uçtan uca senaryo testi.** Bir şikâyeti halka açık formdan açar ve akışın
tamamını arayüz üzerinden yürütür: Fabrika Müdürü dosyayı açıp **formun
kendisini** gördüğünü, formun altındaki düzenekte kişi sayısı seçilince o kadar
kişi kutusu belirdiğini ve unvan + isim seçilerek ekibin kurulduğunu doğrular;
sonra sırayla inceleme tutanağını, imzalı karar tutanağını, iade belgesini ve
resmî yazıyı **dosya yükleyerek** kaydeder, dosyayı kapatır ve müşteri
tarafındaki sonucu doğrular. Bir aşama kaydedilemezse test o noktada durur.

```bash
npm install -D playwright && npx playwright install chromium
npm run dev                          # ayrı bir terminalde
npm run test:senaryo                 # varsayılan http://localhost:3000
npm run test:senaryo -- http://localhost:3100   # başka adres
```

Test 21 kontrolün tamamını doğrular ve başarısızlık hâlinde sıfırdan farklı
çıkış kodu döndürür.

**Tek sorumlu ve sıra kuralı testi.** Aşamaların tek kişide durduğunu ve sırayla
kapandığını doğrular: aşamanın sorumlusu "Sıra sizde" görür ve kayıt formu
açılır, aynı fabrikadaki başka personel aynı aşamada form görmez ve aşamanın
kimde olduğunu okur, sırası gelmeyen aşama hangi aşamayı beklediğini yazar,
Fabrika Müdürü kaydı girebilir ve sorumluyu değiştirebilir, başka fabrikanın
personeli dosyayı hiç açamaz, elle "tamamlandı" yolu yoktur.

```bash
npm run test:sahiplik                       # varsayılan http://localhost:3000
TEST_BASE=http://localhost:3100 npm run test:sahiplik
```

Test, dosyayı veritabanından kendisi seçer; öncesinde **Tanımlar > Demo Verisi**
ekranından demo verisi üretilmiş olmalıdır. Son bölümü açık dosyaların hepsini
tarar ve sırası gelmiş aşamanın sorumlusuna gerçekten yapacak iş gösterildiğini
doğrular — "sorumluya işlem yok denmez" değişmezi bu taramayla korunur.

> Kurumsal ağ arkasında `npx playwright install chromium` komutu tarayıcıyı
> indiremeyebilir (indirme `playwright.azureedge.net` üzerinden yapılır). Bu
> yalnızca senaryo testini etkiler; uygulamanın kendisi çalışmaya devam eder.

## Talimattan sapmalar ve eklemeler

Aşağıdakiler TL PASAT 004'te açıkça yer almayan, sistemin tutarlı çalışması için
eklenen unsurlardır. Kurum onayıyla değiştirilebilirler.

1. **Belgeler uygulamada üretilmez, yüklenir.** Talimat hangi tutanağın
   düzenleneceğini ve kimlerin imzalayacağını belirler ama bunun elektronik mi
   kâğıt üzerinde mi yapılacağını söylemez. Uygulama, fabrikanın gerçek iş
   akışına paralel ikinci bir onay süreci işletmek yerine o akışın **sonucunu**
   kayda geçirir: tutanak dışarıda hazırlanıp imzalanır, imzaları tamamlanmış
   nüsha ilgili aşamaya yüklenir. Sistem belgeyi kimin, hangi tarihte kayda
   geçirdiğini saklar.

2. **Kararın tutanakla kesinleşmesi.** Haklı/haksız kararı ayrı bir aşama
   değildir; imzalı karar tutanağı yüklenirken işaretlenir. Bu, md. 4'teki
   "düzenlenen tutanaklar fabrika müdürünün onayından sonra…" ifadesine
   uygundur — onay fabrikada ıslak imzayla verilir.

3. **Daire itirazı kabul ettiğinde işlem süresinin yeniden başlaması.** Talimat
   iade/değişim için şikâyet tarihinden itibaren 5 iş günü öngörür. Daire
   Başkanlığı kararı bu süreden sonra geldiğinde süre fiilen imkânsız hâle
   gelir; bu nedenle karar kabul edildiğinde 5 iş günlük süre **daire kararı
   tarihinden** yeniden başlatılır ve bu yeniden başlatma olay günlüğüne ayrıca
   işlenir.

4. **SMS ile telefon doğrulaması.** Halka açık formda sahte kayıt önlenmesi ve
   bilgilendirme SMS'lerinin doğru numaraya ulaşması için zorunludur; Tanımlar
   sayfasından kapatılabilir.

5. **Şikâyet numarası biçimi** `YIL-FABRİKAKODU-SIRA` (örnek `2026-ANK-0001`).
   Numara üretici fabrikadan alınır ve dosya başka fabrikaya yönlendirilse bile
   değişmez; böylece müşteriye verilen numara kalıcı olur.

6. **"Daha yakın fabrika" önerisi**, müşterinin seçtiği ilin merkez koordinatı
   ile 14 fabrikanın koordinatları arasındaki kuş uçuşu mesafeden hesaplanır.
   Öneridir; yönlendirme kararı her hâlükârda Fabrika Müdürünündür.

7. **PDF üretimi** tarayıcının yazdırma işleviyle yapılır. Sunucu tarafında
   doğrudan PDF üretimi gerekirse Playwright/Puppeteer ile `/belge/[id]`
   sayfasının çıktısı alınabilir.

8. **Müşteri Şikâyet Formu (FR PASAT 007) bir kayıt belgesidir.** Müşterinin
   beyanını kayda geçirir; bir karar belgesi değildir. Kayıt anında üretilir ve
   dosyayı açan personelin ilk gördüğü şeydir.

9. **İade/değişim tutarları isteğe bağlıdır.** Aşamayı kapatan şey yüklenen
   belgedir; iade kg, değişim kg, iade bedeli ve nakliye bedeli alanları
   yalnızca Genel Müdürlüğe giden **aylık tablo** ve maliyet takibi beslensin
   diye istenir ve boş bırakılabilir. Boş bırakılan alan mevcut değeri bozmaz.

10. **Ekibin kaç kişi olacağına Fabrika Müdürü karar verir.** Talimat md. 3
    ekibin hangi birimlerden kurulacağını sayar ama kişi sayısını
    belirlemez. Düzenek 1-8 kişi arası serbest bırakılmıştır; unvan listesi
    fabrikanın kadrosundan otomatik gelir, aynı kişi iki kez seçilemez ve ilk
    sıradaki kişi ekip lideri olur.

11. **Fabrika Müdürü bir aşamanın kaydını sorumlusu yerine girebilir.** İş
    fabrikada elle yapıldığı ve belge dışarıda hazırlandığı için, kaydın
    bilgisayar başındaki kişi tarafından girilmesi olağandır. Her kayıt kimin
    girdiğini saklar; izlenebilirlik kaydedenin kimliğiyle korunur. Müdür
    ayrıca bir aşamanın sorumlusunu değiştirebilir ve koşulu oluşmayan aşamayı
    gerekçeyle atlayabilir.

---

© Türkiye Şeker Fabrikaları A.Ş.
