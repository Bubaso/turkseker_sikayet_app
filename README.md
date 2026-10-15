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
- [Kurumsal kimlik](#kurumsal-kimlik)
- [Dar ekran](#dar-ekran)
- [Geniş ekran](#geniş-ekran)
- [Yapılandırma](#yapılandırma)
- [Canlıya geçiş adımları](#canlıya-geçiş-adımları)
- [Başka bir adresten erişim](#başka-bir-adresten-erişim-tünel-vekil-sunucu-alan-adı)
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
- Süreç adımları, kalan süreler ve bilgilendirme kaydı (hangi kilometre taşında,
  ne zaman, hangi kanaldan)

**Fabrika paneli**
- Gösterge paneli, şikâyet dosyaları, bana düşen aşamalar
- Listelerde ayrı filtre kutusu yoktur: süzgeçler **sütun başlıklarındaki
  oklarda** durur (fabrika, tarih, şikâyet türü, ürün grubu, durum, karar,
  gecikme). Seçim adres satırına yazılır; filtrelenmiş liste paylaşılabilir ve
  geri tuşu çalışır. Açık filtreler listenin üstünde tek tek kaldırılabilir
  rozetler olarak görünür.
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

Menüde iki şey vardır: **gösterge paneli** ve **şikâyet dosyaları**. Ayrı bir
rapor, fabrika karşılaştırma, dikkat listesi ya da aylık tablo ekranı yoktur;
hepsi gösterge panelinde toplanmıştır.

- Üç net sayı: **toplam şikâyet**, **işlemi devam eden**, **geciken**
- Dönem seçici ve önceki dönemle kıyaslı göstergeler: gelen, SLA uyumu,
  ortalama kapanma, toplam maliyet
- Grafikler: 12 aylık seyir, fabrika karşılaştırma, fabrikalara göre SLA
  uyumu, şikâyet türü ve ürün grubu dağılımı, aşama bazında süre uyumu
- Çıktılar: A4 yönetim özeti ve aylık şikâyet tablosu (Excel)

Daire Başkanı panosu **aynı ölçülerin tamamını** taşır; farkı, hepsinin
dairenin merceğinden süzülmesi ve en üstte kendi karar kuyruğunun durmasıdır.
Üstüne dört ölçü daha gelir: kararım bekleniyor, karara bağladığım, ortalama
karar sürem, okunmamış resmî yazı.

**Raporlama**

Hiçbir ölçü hem grafik hem tablo olarak gösterilmez. Varsayılan grafiktir;
sayıyı tek tek okumak isteyen başlıktaki **Tablo** düğmesiyle geçer, aynı
düğme geri döndürür. Fabrika personeli kendi fabrikasının aynı ölçülerini
**Performans panosu** sayfasında görür.

Aylık Müşteri Şikâyetleri Tablosu (FR PASAT 005, 17 kolon) ekranda bir sekme
olarak durmaz; gösterge panelindeki **Aylık tablo (Excel)** düğmesiyle
indirilir.

**Belge**

Uygulamanın ürettiği tek belge **FR PASAT 007 Müşteri Şikâyet Formu**'dur:
müşterinin beyanının kaydıdır ve kayıtla birlikte otomatik oluşur. Dosyada üç
yerde durur:

1. **Dosyanın en üstünde**, formun kendi düzeninde, açık olarak — dosyayı açan
   personelin ilk gördüğü şey budur. Dosya ileri aşamalara geçtiğinde
   katlanabilir.
2. **Bütün ekler** listesinin ilk satırında, "uygulamanın ürettiği belge"
   olarak. Diskte bir dosyası olmadığı için boyutu yoktur ve silinemez;
   **Göster** düğmesi A4 çıktısını sayfadan ayrılmadan bir pencerede açar
   (oradan yazdırılabilir ya da yeni sekmede açılabilir).
3. **Formu yazdır** düğmesiyle tam sayfa A4 çıktısı olarak. Tarayıcının
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
                            (üst yönetim panosu rapor ve karşılaştırmayı da içerir)
    belge/[id]/             Müşteri Şikâyet Formu çıktısı (A4)
    api/ek/[id]/            yetkili dosya servisi
    api/rapor/aylik/        Excel çıktısı
  components/               ortak arayüz bileşenleri, grafikler
    sikayet-formu.tsx       FR PASAT 007 — panelde ve yazdırmada ortak
    surec-seridi.tsx        müşteri takip sayfasının adım şeridi
    grafik.tsx              grafik / tablo geçişli kutu — ikisi aynı anda gösterilmez
    tablo-filtre.tsx        sütun başlığındaki filtre oku
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

Ana sayfa üç soruyu yanıtlar ve orada biter: **nereye başvuracağım, ne kadar
sürecek, başvururken elimde ne olmalı.** Süreç özeti üç satırdır — kaydedersiniz
(anında), ürününüz incelenir (3 iş günü), sonuç uygulanır ve bildirilir (8 iş
günü). Daha fazlası müşteriye başvurmadan önce bir şey kazandırmaz; adımların
tamamını, gerçekleşme tarihleriyle birlikte, **başvurduktan sonra takip
sayfasında** görür.

Takip sayfasındaki şerit (`src/components/surec-seridi.tsx`) tamamlanan adımı
yeşil onay işaretiyle ve tarihiyle, koşulu oluşmayan adımı çizgiyle, bekleyeni
numarayla gösterir. Sayfanın tamamı tek ekrana sığar.

Bildirim kaydı mesajların **metnini basmaz**: metinler zaten müşterinin
telefonunda ve e-posta kutusundadır, sayfada tekrarlanmaları dosyanın durumunu
görünmez hâle getiriyordu. Onun yerine katlanmış tek satırın altında kilometre
taşı başına bir satır durur — ne zaman, hangi kanaldan haberdar edildiği. Aynı
taşın SMS'i ve e-postası tek satırda birleşir.

Metinlerde **kurum iç işleyişi yer almaz**: hangi unvanın ne yaptığı, tutanak,
imza, Daire Başkanlıklarına raporlama gibi ayrıntılar müşteriyi ilgilendirmediği
için yazılmaz. Her cümle müşterinin başına geleni anlatır ("Sonuç her hâlükârda
gerekçesiyle bildirilir"). Bu ölçüt halka açık üç sayfanın tamamı için
geçerlidir: karşılama, şikâyet formu ve takip sayfası. Altbilgide de yalnızca
telif ve KVKK satırı durur; talimat numarası yer almaz.

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

### Hangi rol neyi görür

| | Fabrika personeli | Genel Müdür Yrd. | Daire Başkanı |
|---|---|---|---|
| Gösterge paneli | günlük iş | 14 fabrikanın tamamı + raporlar | aynısı, dairenin merceğiyle + karar kuyruğu |
| Şikâyet dosyaları | kendi fabrikası | hepsi | hepsi |
| Bana düşen aşamalar, Takvim, SMS kutusu, Performans panosu | ✓ | — | — |
| Kararımı bekleyenler, Resmî yazılar | — | — | ✓ |
| Yönetim özeti (A4) | — | ✓ | ✓ |

Genel Müdürlük tarafı izleyicidir: ayrı rapor, fabrika karşılaştırma, dikkat
listesi ve aylık tablo ekranları kaldırılmış, hepsi gösterge paneline
toplanmıştır. Eşiği aşan itiraz ilgili **Daire Başkanlığına** gittiği için
karar kuyruğu da yalnızca orada görünür.

#### Daire merceği

Her Daire Başkanlığının doğal bakış açısı `src/lib/mercek.ts` içinde tek yerde
tanımlıdır ve hem gözetim hem performans sorgularını süzer: Pazarlama dökme
şeker, melas ve posa; Perakende paketli şeker; Şeker Üretim üretim kaynaklı
kusurlar (ürün kalitesi ve gıda güvenliği aileleri); Mali İşler ve Strateji
kurum geneli. Daire Başkanı bu merceğin dışını görmek isterse şikâyet
dosyalarından tüm ürün gruplarına geçer. A4 yönetim özeti de aynı mercekle
üretilir.

### Bir ölçü, bir gösterim

Hiçbir sayı ekranda iki kez durmaz. Grafiği olan bir ölçünün tablosu
varsayılan olarak gizlidir; başlıktaki **Tablo** düğmesi grafiği tablonun
yerine koyar, aynı düğme geri alır (`src/components/grafik.tsx`). Ölçerler
(SLA çubukları) yüzdeyi zaten üzerinde taşıdığı için ayrı tabloları yoktur.

Liste filtreleri de ayrı bir kutuda toplanmaz: her süzgeç, süzdüğü sütunun
başlığındaki okta durur (`src/components/tablo-filtre.tsx`). Seçim adres
satırına yazıldığı için filtrelenmiş liste paylaşılabilir ve tarayıcının geri
tuşu çalışır.

### Ekip ve aşama görevlendirmesi

Fabrika Müdürü ekibi kurarken iki şey söyler: **kim var** ve **hangi aşama
kimde**. İkinci kısım `stage_assignments` tablosunda saklanır ve aşama
açıldığında oradan okunur (`asamalariAc` → `gorevlendirilen`). Bunun önemi şu:
iade/değişim ve resmî yazı aşamaları ancak karar verildikten sonra açılır, yani
ekip kurulurken henüz ortada bir görev satırı yoktur. Görevlendirme beklemede
durur ve aşama açıldığı anda uygulanır — iş akışı unvana göre değil, dosyayı
bilen müdürün dediğine göre kurulur.

Dağıtılabilen dört aşama vardır (`EKIP_ASAMALARI`): inceleme, karar tutanağı,
iade/değişim, resmî yazı. Dışarıda kalanların sorumlusu tartışmasızdır — ekip
kurma ve dosya kapanışı müdürün kendi işi, itiraz gönderimi yine müdürün, daire
kararı ilgili Daire Başkanlığının.

Görevlendirme **ekiple sınırlıdır**: bir aşamayı birine vermek için önce o
kişiyi ekibe almak gerekir. Dosyada çalışacak herkes ekiptedir, böylece "bu
dosyaya kim baktı" sorusunun tek bir cevabı olur — iade/değişimi Ambar Şefi
yapacaksa Ambar Şefi de inceleme ekibinde yer alır.

Varsayılan, unvanı aşamanın rolüne uyan ekip üyesidir; boş bırakılan aşama o
kişiye, o unvan ekipte yoksa ekip liderine düşer. Unvan ekipte yoksa kutunun
altında uyarısı çıkar, böylece müdür ya o kişiyi ekibe ekler ya da aşamayı
bilerek başkasına verir. Sunucu aynı kuralı yeniden uygular: ekip dışından
gelen bir seçim yok sayılır.

Kurulan ekip dosya sayfasında kalıcı olarak durur: kim vardı, kim liderdi ve
kim hangi aşamadan sorumluydu. "Bu dosyaya kim baktı" sorusu dosya kapandıktan
sonra da sorulur; denetimde ilk sorulan budur.

### Kanıt görselleri

Şikâyetin ne olduğunu çoğu zaman en iyi anlatan şey müşterinin çektiği
fotoğraftır: topaklanmış çuval, yırtık torba, yabancı madde. Şikâyet Formunun
**KANITLAR** satırı artık dosya adı değil görselin kendisini gösterir;
üzerine tıklanınca büyür (ok tuşlarıyla gezilir, Esc kapatır, odak pencerenin
içinde döner, arkadaki sayfa kaymaz).

Aynı galeri "Bütün ekler" bölümünde de kullanılır — aynı görsele dosyanın iki
yerinde tıklamak aynı şeyi yapar (`src/components/gorsel-galeri.tsx`, iki
düzen: `serit` ve `izgara`). Tarayıcının çizemediği biçimler (PDF, Word, HEIC)
bağlantı olarak listelenir; dosyası okunamayan bir görsel de bağlantıya
düşer.

Kâğıtta da görsellerin kendisi basılır: basılı bir formda "• foto1.jpg"
satırı hiçbir şey anlatmaz, fotoğraf ise şikâyetin kanıtıdır.

Demo verisi artık kanıt görseli de üretir — şikâyet türüne göre değişen,
bakışta ayırt edilen desenler (topaklanma, yabancı madde, yırtık çuval,
sararma). Üretici küçük bir PNG kodlayıcı taşır (`src/server/demo.ts`); harici
bir görsel kitaplığı gerekmez.

### Tutanak örnekleri

Uygulama belge üretmez — bu kural değişmedi. Ama elle hazırlanan her tutanak
için, kayıt kutusunda **"Tutanak örneğini aç"** düğmesi vardır. Açılan sayfa
dosyanın bilinen bilgileri doldurulmuş, geri kalanı çizgili bırakılmış bir
kâğıttır: künye, müşteri beyanı, işaretlenecek seçenekler, elle doldurulacak
alanlar ve dosyanın gerçek görevlilerinden kurulu imza bloğu.

Kullanıcı isterse yazdırıp elle tamamlar ve imzalatır, isterse hiç açmadan
kendi belgesini yükler. Üretilen sayfa bir sistem belgesi değildir: belge
numarası taşımaz, denetim izine yazılmaz, dosyaya kendiliğinden eklenmez.
Aşamayı kapatan şey yüklenen ıslak imzalı nüshadır.

Altı aşamanın örneği vardır: inceleme tutanağı, karar tutanağı, Daire
Başkanlığına üst yazı, daire karar yazısı, iade/değişim tutanağı, resmî yazı.
Şablonlar `src/lib/tutanak.ts` içinde **veri olarak** durur; çizim tek bir
sayfada yapılır, yeni bir aşama için oraya bir kayıt eklemek yeter.

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

## Kurumsal kimlik

Uygulama kurumun kendi marka kılavuzuna göre giydirilmiştir; hiçbir öğe
yeniden çizilmemiş, logo dosyalarının vektörleri olduğu gibi kullanılmıştır.

### Logo

Marka kılavuzundaki üç kilit `public/marka/` altında SVG olarak durur ve
`src/components/marka.tsx` üzerinden çağrılır:

| Bileşen | Dosya | Nerede |
|---|---|---|
| `<Logo />` | `turkseker-logo.svg` (330 × 63,4) | Halka açık antet, A4 belge ve yönetim özeti başlığı |
| `<LogoDikey />` | `turkseker-logo-dikey.svg` (170,2 × 177,3) | Personel giriş ekranı |
| `<Amblem />` | `turkseker-amblem.svg` (62 × 62) | Panel anteti, altbilgi, tarayıcı simgesi (`src/app/icon.svg`) |

Her birinin koyu zemin için `-beyaz` nüshası vardır; bileşenlere `beyaz`
özelliği geçilerek seçilir. Kılavuzun iki kuralı bileşenlerde kodludur:

1. Logonun çevresinde **amblem yarıçapı kadar** boşluk bırakılır.
2. Koyu veya yeşil zeminde **yalnızca beyaz nüsha** kullanılır.

Oranlar dosyaların kendi `viewBox` değerinden gelir; bileşenler tek bir ölçü
(yükseklik ya da genişlik) alır ve diğerini kilitli orandan hesaplar, yani
logo hiçbir yerde esnetilemez.

### Renk

| Rol | Değer | Kullanım |
|---|---|---|
| Marka yeşili | `#006938` (`brand-600`) | Antet çizgisi, birincil düğme, etkin sekme ve menü, odak halkası |
| Kurum ikincil | `#B3BA00` | Kurum sitesinde kullanılır; **uygulamada kullanılmaz** |
| Logo siyahı | `#231F20` | Yalnızca logo dosyasının içinde |

`brand-50`…`brand-900` rampası `#006938`'den türetilmiştir
(`src/app/globals.css`). Kurum sitesi aynı yeşili `#046A38` olarak kullanır;
fark gözle seçilmediği için logo dosyasındaki değer esas alınmıştır.

**Marka yeşili kimliği işaretler, veriyi değil.** Bir sayıda yeşil "iyi"
demek olduğu için marka yeşili sayılara hiç girmez — `Stat` bileşeninin ton
listesi bunu tip düzeyinde kapatır (`ink | ok | warn | danger`). Sayıların
rengi tek kurala uyar:

| Renk | Anlamı | Örnek |
|---|---|---|
| Gri | Düz sayım | Toplam şikâyet, işlemi devam eden |
| Sarı | Borçlu olunan iş | Belge bekleyen, okunmamış resmî yazı, kuyruktaki bildirim |
| Kırmızı | Gecikmiş | Geciken dosya, hatalı bildirim |
| Yeşil | İstenen sonuca ulaşıldı | Bu ay kapanan, gönderilen bildirim |

Aynı ayrım rozetlerde de geçerlidir: dolu yeşil rozet bir **çağrıdır**
("Sıra sizde", "Okunmadı", yönlendirme işareti), sınıflandırma değildir.
Kanal, ek türü ve denetim izi satır türü gibi etiketler sessiz tonlarda
(gri/mavi) kalır.

Grafik paleti bundan ayrıdır ve renk körlüğüne göre doğrulanmış mavi-turuncu-
turkuaz dizisini korur (`--viz-*`); kurumun zeytin-limon ikincil rengi bu
ayrımı bozduğu için grafiklere sokulmamıştır.

Karşıtlık değerleri WCAG 2.1'e göre ölçülmüştür: beyaz üzerinde marka yeşili
6,82:1 (AA), marka dolgusu üzerinde beyaz metin yine 6,82:1, koyu nüsha
`brand-700` 8,38:1 (AAA). Durum renkleri de AAA eşiğindedir (ok 7,29; sarı
7,09; kırmızı 8,31). En düşük değer gri ipucu metnindedir: 4,76 (AA).

### Yazı ölçeği

Arayüzde tekrar eden üç ölçü `globals.css` içinde ad almıştır; çağrı yerinde
sayı değil niyet durur ve ölçü tek yerden değişir:

| Belirteç | Değer | Nerede |
|---|---|---|
| `text-baslik` | `0.8125rem` (13px) | Kart ve bölüm başlıkları, form etiketi, küçük düğme |
| `text-rozet` | `0.6875rem` (11px) | Rozet, adım numarası, menü grubu başlığı |
| `text-mini` | `0.625rem` (10px) | Takvim hücresi, küçük işaret |

Hepsi `rem`'dir — gerekçesi için [erişilebilirlik
notuna](#türkşeker-sitesine-entegrasyon) bakın.

---

## Dar ekran

Uygulama sahada telefondan da kullanılır: Fabrika Müdürü dosyayı ambarda açar,
Kalite Sorumlusu aşamayı yerinde kaydeder. Dar ekran bu yüzden masaüstünün
küçültülmüş hâli değil, kendi düzeni olan bir görünümdür.

### Menü çekmecede durur

Kenar çubuğu dar ekranda içeriğin üstüne yığılıyordu: kullanıcı her sayfada
önce on bir menü maddesini geçip sonra içeriğe varıyordu. Menü artık
başlıktaki düğmeden açılan bir çekmecededir (`src/components/panel-cekmece.tsx`)
ve sayfa doğrudan içerikle başlar. Çekmece kalıcı pencere gibi davranır: arka
plan kararır ve dokununca kapanır, Esc kapatır, sekme odağı içeride döner,
açıkken sayfa kaymaz, başka sayfaya geçilince kendiliğinden kapanır. Hareket
kısıtlaması isteyen kullanıcıda animasyon çalışmaz.

Menünün tanımı tek yerdedir (`src/components/panel-menu.ts`); kenar çubuğu ile
çekmece aynı kaynaktan beslenir, madde eklemek iki yerde iş çıkarmaz.
Çekmecenin altında kullanıcının adı ve unvanı durur — başlıkta dar ekranda
gizlendiği için kimle oturum açıldığı başka yerde görünmüyordu.

### Liste kart olur

Şikâyet listesi 360px'lik bir ekranda 1600px genişliğindeydi ve en çok bakılan
sütun — durum — ekranın dışında kalıyordu. `lg` altında aynı veri kart olarak
çizilir (`src/components/complaint-table.tsx`): kartın tamamı dokunma hedefidir
ve sıralama önceliğe göredir — kim, ne, nerede durduğu, sırada ne olduğu.

Sütun süzgeçleri kartta da erişilebilir: başlık olmadığı için listenin üstünde
yatay kayan bir şeritte toplanırlar. Seçili süzgeç dolu çizilir ve seçimi
üzerinde yazar, yani şerit aynı zamanda neyin açık olduğunun özetidir. Süzgeç
bileşeni tek bileşendir (`tablo-filtre.tsx`), yalnızca görünümü değişir.

### Takvim özete iner

Yedi sütunluk ızgarada hücre dar ekranda ~50px kalıyor ve aşama başlıkları
sütunun dışına taşıyordu. `sm` altında hücre bir özettir: ne olduğunu renkli
noktalar söyler (yeni şikâyet, aşama son tarihi, gecikmiş, resmî tatil) ve
altında nokta kodunun karşılığı durur. Ayrıntı — hangi aşama, hangi dosya, kim
— ızgaranın altındaki listede okunur. O liste yalnızca dar ekranda çizilir:
geniş ekranda aynı bilgi hücrelerde zaten yazılı ve iki yerde birden durması
gereksiz tekrar olurdu.

### Dokunma ve yazı

| Kural | Değer | Nereden |
|---|---|---|
| Dokunma hedefi | en az 24×24, birincil eylemlerde 44×44 | WCAG 2.2 AA (2.5.8) ve yerleşik teamül |
| Form alanı yazı boyutu | dar ekranda en az 16px | iOS Safari daha küçüğüne odaklanınca sayfayı yakınlaştırır |
| Serbest metin | `break-words` | Uzun takip bağlantısı satır sonunda kırılmazsa sayfayı yatay kaydırır |

A4 çıktı önizlemeleri (`/belge/[id]`, `/panel/ozet`) kâğıt ölçüsünü korur ve
kendi kutusunda yatay kayar; sayfanın tamamı kaymaz. Kâğıdı ekrana sığacak
kadar küçültmek metni okunmaz yapardı.

Bildirim kutusunda mesaj gövdeleri katlı durur. Bu sayfa gönderilenin
kanıtıdır, okuma listesi değil: elli bildirimin tam e-posta metni açıkken liste
dar ekranda 49.000 piksel uzuyordu, şimdi 7.000.

### Testi

`npm run test:mobil` iki cihaz ölçüsünde (360×740 ve 375×667) on sekiz sayfayı
gezer ve her birinde yatay taşma, 24px altı dokunma hedefi, 16px altı form
alanı ve kırpılan metin arar; ardından çekmecenin ve kart listesinin
davranışını sınar. 156 kontrol.

---

## Geniş ekran

Panel bir veri aracıdır: geniş ekranda kenar boşluğuna değil tabloya yer
ayrılır. İçerik 1760px'e kadar genişler; 1500px sınırı 1920'lik bir ekranda
şikâyet tablosunu yana kaydırıyor ve en çok bakılan sütunları — durum, karar,
sıradaki adım — ekranın dışında bırakıyordu.

Tablo her masaüstü genişliğinde tam oturur (1280'den 2560'a kadar ölçülmüştür).
Bunu üç karar sağlar:

- **Durum ve karar tek sütundadır.** İkisi birlikte okunur; ayrı sütun 93px
  yer alıyordu. Başlıkta iki süzgeç yan yana durur.
- **Listede kısa durum adı kullanılır** (`STATUS_SHORT_LABEL`). "İnceleme ve
  belge toplama" bir hücrede 215px kaplıyordu; "İncelemede" 120px. Tam ad
  dosyanın başında ve rozetin `title` ipucunda durur.
- **Ürün ve miktar ikincil sütunlardır** ve ancak `genis` kırılma noktasında
  (1760px) açılır. Bu sayı `--breakpoint-genis` olarak tanımlıdır ve içerik
  genişliğinin üst sınırıyla aynıdır: ikisi birlikte "ikincil sütunlar ancak
  gerçekten yer varken görünür" kuralını kurar.

Kesilen metinlerin tamamında `title` ipucu vardır; dar ekrandaki kart düzeni
zaten tam metni gösterir.

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

## Başka bir adresten erişim (tünel, vekil sunucu, alan adı)

Uygulamaya `localhost` dışında bir adresten erişilecekse — tanıtım için
açılan geçici bir tünel, kurumsal bir ters vekil sunucu ya da gerçek alan
adı — o adres `ALLOWED_ORIGINS` ile tanıtılmalıdır:

```env
ALLOWED_ORIGINS=ornek.trycloudflare.com
ALLOWED_ORIGINS=sikayet.turkseker.gov.tr,10.0.0.5:3000
```

**Neden gerekli:** Next.js, Server Action isteklerinde `origin` başlığıyla
`x-forwarded-host` başlığının eşleşmesini arar; eşleşmezse isteği *Invalid
Server Actions request* diyerek reddeder. Bu uygulamanın her düğmesi bir
Server Action olduğu için, adres tanıtılmadan bir vekil sunucunun arkasında
**giriş bile çalışmaz** — sayfalar açılır, hiçbir işlem yapılamaz.

Değişken başlatma anında okunur; adres değiştiğinde yeniden derlemek
gerekmez, sunucuyu yeniden başlatmak yeter. Ayrıca `APP_BASE_URL` de aynı
adrese çekilmelidir, yoksa SMS'lerdeki takip bağlantıları `localhost` der.

### Geçici tanıtım bağlantısı

Kurulum gerektirmeden bir bağlantı üzerinden göstermek için
[cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)
yeter (hesap gerekmez):

```bash
cloudflared tunnel --url http://localhost:3000     # → https://xxx.trycloudflare.com
```

Ardından uygulamayı o adresi tanıyarak başlatın:

```bash
ALLOWED_ORIGINS=xxx.trycloudflare.com \
APP_BASE_URL=https://xxx.trycloudflare.com \
npm run start
```

Bu bir barındırma değil, kendi makinenize açılan bir tüneldir: bilgisayar
açık ve uygulama çalışır durumda olmalıdır. Bağlantı herkese açıktır ve demo
hesaplarının şifresi bilinendir; tanıtım bitince tüneli kapatın.

## Türkşeker sitesine entegrasyon

Uygulamanın doğal girişi kurum sitesinin **Sistemler** menüsündeki *Müşteri
Memnuniyeti* başlığıdır; şikâyet formu ve takip sayfası oraya iki bağlantı
olarak konur. Uygulamanın anteti, yeşili ve logosu kurum sitesiyle aynı
olduğu için ziyaretçi bağlantıya tıkladığında başka bir siteye geçtiğini
hissetmez; uygulamanın altbilgisi de `turkseker.gov.tr` adresine geri döner.

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

Kurum sitesinde görme engelliler için bir erişilebilirlik çubuğu (yazı
büyütme, yüksek karşıtlık) bulunur. Uygulama ayrı bir çubuk taşımaz; aynı
sonucu tarayıcının kendi ayarlarıyla verir:

- **Yazı boyutu.** Arayüzdeki bütün ölçüler `rem` tabanlıdır, yani tarayıcıda
  ayarlanan varsayılan yazı boyutunu dinler. Gövde boyutu da dahildir
  (`globals.css` içinde `0.875rem`); px yazılsaydı sınıfı olmayan her
  paragraf ayarı görmezden gelirdi. Kök 16px'ten 20 ve 24px'e çıkarıldığında
  panolar, şikâyet listesi, dosya sayfası ve takvim yatay taşma ya da kırpılan
  metin olmadan büyür — bu durum testle doğrulanır.
- **Renk.** Hiçbir durum yalnızca renkle anlatılmaz (her rozetin metni
  vardır) ve grafik paleti renk körlüğüne göre seçilmiştir.

İki yer bilerek `rem` dışındadır. A4 çıktıların (`/belge/[id]`,
`/panel/ozet`) yazı boyutu `pt`'dir: bunlar 210mm'lik kâğıt kutusu içinde
çizilir ve ekrandaki önizlemenin baskıyla birebir aynı olması gerekir.
Grafiklerin SVG etiketleri de `viewBox` biriminde kalır; kabın genişliğiyle
ölçeklenirler ama yazı boyutu ayarını dinlemezler. Bunu değiştirmek grafik
bileşenini yeniden kurmayı gerektirir.

---

## Testler

```bash
npm run typecheck      # TypeScript tür kontrolü
npm run test:surucu    # SQLite sürücü davranış testi (21 kontrol, saniyeler sürer)
npm run build          # üretim derlemesi

# Tarayıcı gerektirenler (sunucu ayakta ve demo verisi üretilmiş olmalı)
npm run test:senaryo   # uçtan uca şikâyet akışı
npm run test:sahiplik  # tek sorumlu ve sıra kuralı
npm run test:olcek     # yazı ölçeği / erişilebilirlik
npm run test:mobil     # dar ekran düzeni ve dokunma hedefleri
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

**Yazı ölçeği testi.** Arayüzün tarayıcının yazı boyutu ayarını dinlediğini
doğrular. Kök yazı boyutunu 16, 20 ve 24px yapıp beş yoğun sayfayı gezer ve
her birinde üç şeyi kontrol eder: gövde yazı boyutu kökle orantılı büyüyor
mu (yani hiçbir yerde px'e sabitlenmemiş mi), sayfa yatay taşıyor mu,
kutusuna sığmayıp kırpılan metin var mı. Üç nokta ile kısaltılan metinler
kasıtlıdır, sayılmaz.

```bash
npm run test:olcek                          # varsayılan http://localhost:3000
TEST_BASE=http://localhost:3100 npm run test:olcek
```

A4 çıktı sayfaları bilerek kapsam dışıdır; gerekçesi
[erişilebilirlik notundadır](#türkşeker-sitesine-entegrasyon).

**Dar ekran testi.** İki cihaz ölçüsünde on sekiz sayfayı gezip yatay taşma,
24px altı dokunma hedefi, 16px altı form alanı ve kırpılan metin arar; sonra
menü çekmecesinin (açılma, Esc, sayfa kilidi, sayfa değişince kapanma) ve kart
listesinin davranışını sınar. Ayrıntısı [Dar ekran](#dar-ekran) bölümündedir.

```bash
npm run test:mobil                          # varsayılan http://localhost:3000
TEST_BASE=http://localhost:3100 npm run test:mobil
```

> Kurumsal ağ arkasında `npx playwright install chromium` komutu tarayıcıyı
> indiremeyebilir (indirme `playwright.azureedge.net` üzerinden yapılır). Bu
> yalnızca tarayıcı gerektiren testleri etkiler; uygulamanın kendisi çalışmaya
> devam eder.

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
