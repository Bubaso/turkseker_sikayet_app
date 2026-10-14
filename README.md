# Türkşeker Müşteri Şikâyet Takip Sistemi

Türkiye Şeker Fabrikaları A.Ş.'nin 14 şeker fabrikası ve Genel Müdürlük daire
başkanlıkları için müşteri şikâyetlerinin kaydı, incelenmesi, karara bağlanması
ve raporlanmasını uçtan uca yürüten kurumsal uygulama.

Süreç **TL PASAT 004 "Müşteri Şikâyetlerinde Uygulamalar"** talimatına birebir
uyacak şekilde modellenmiştir; talimatın ekindeki FR PASAT 004, 005 ve 007
formları sistem verisinden otomatik üretilir.

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

| # | Adım | Süre (iş günü) | Sorumlu | Dayanak |
|---|---|---|---|---|
| 1 | Şikâyet kaydı + Müşteri Şikâyet Formu (FR PASAT 007) | 0 | Fabrika / müşteri | md. 1 |
| 2 | İnceleme ekibi oluşturma **veya** daha yakın fabrikaya yönlendirme | ≤ 1 | Fabrika Müdürü | md. 2-3 |
| 3 | Yerinde (ya da görsel üzerinden) inceleme | ≤ 3 | Ekip | md. 4 |
| 4 | Numune alma ve laboratuvar analizi | aynı gün / ertesi iş günü | Kalite ve İşl. Kontrol Lab. | md. 4 |
| 5 | Tutanak düzenleme, 6 imza + Fabrika Müdürü onayı | ≤ 3 | İmza zinciri | md. 4 |
| 6 | FSSC 22000 düzeltici faaliyet | — | Gıda Güvenliği Ekibi | md. 4 |
| 7 | Haksız + eşik aşımı → Daire Başkanlığı itiraz değerlendirmesi | ≤ 5 | İlgili daire | md. 5 |
| 8 | İade / değişim işlemi | ≤ 5 | Ambar Şefi | md. 6-a/b |
| 9 | Nakliye bedelinin ödenmesi | ≤ 5 | Muhasebe | md. 6-b |
| 10 | Resmî yazı + ekleri 4 Daire Başkanlığına | işlemden ≤ 3 | Kalite Sorumlusu | md. 6 |
| 11 | Müşteri Bilgilendirme Formu | — | Kalite Sorumlusu | md. 7 |
| 12 | Dosyanın kapatılması | işlemden ≤ 3 | Fabrika Müdürü | md. 8 |
| 13 | Aylık Müşteri Şikâyetleri Tablosu | aylık | Fabrika | md. 8 |

**Tüm süreler iş günü bazlıdır.** Hafta sonları ve Tanımlar sayfasında kayıtlı
resmî tatiller hesaba katılmaz.

### İmza zinciri (FR PASAT 004 / 005)

Sıralıdır — önceki unvan imzalamadan sıra bir sonrakine geçmez:

```
Ambar Şefi → Satışı Yapan Birim Şefi → Kalite ve İşletme Kontrol Md. Yrd.
→ Fabrika Müdür Yrd. (Teknik veya Ziraat) → Fabrika Müdür Yrd. (İdari)
→ ONAY: Fabrika Müdürü
```

Her imza ad-soyad, unvan ve zaman damgasıyla kaydedilir ve belge çıktısına
basılır. Islak imzalı taranmış nüsha ayrıca Ekler sekmesinden yüklenebilir.

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

12 kilometre taşında SMS ve e-posta gönderilir: doğrulama kodu, kayıt alındı,
ekip oluşturuldu, yönlendirildi, yerinde inceleme, numune alındı, karar (haklı /
haklı bulunmadı), Genel Müdürlük değerlendirmesi başladı / sonuçlandı, iade-
değişim tamamlandı, dosya kapandı.

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
- Gösterge paneli, şikâyet dosyaları (filtre/arama/SLA renk kodu), görevlerim
- Şikâyet detayı: özet, yapılacak işlem, görev kartları, ekip, numune ve analiz,
  tutanaklar, ekler, bildirimler, geçmiş (denetim izi)
- Ekip oluşturma, yakın fabrikaya yönlendirme, yerinde inceleme kaydı
- Numune ve laboratuvar analizi (16 parametre, spesifikasyona göre otomatik
  uygunluk değerlendirmesi)
- Tutanak düzenleme ve imza zinciri, imza bekleyen belgeler kuyruğu
- İade/değişim ve nakliye bedeli, düzeltici faaliyet, resmî yazı, kapanış
- Takvim: görev son tarihleri, resmî tatiller, yeni şikâyetler
- Elden / telefonla gelen şikâyetlerin personel tarafından kaydı

**Genel Müdürlük paneli**
- 14 fabrikanın tüm dosyaları tek ekranda, fabrika filtresiyle
- Daire bazında itiraz kuyruğu ve karar verme (5 iş günü sayacıyla)
- SMS / e-posta giden kutusu, hatalı gönderimleri yeniden deneme

**Raporlama**
- Performans panosu: SLA uyum oranı, ortalama kapanma süresi, haklı bulunma
  oranı, 14 fabrika karşılaştırması, 12 aylık trend, kategori ve ürün grubu
  dağılımı, kilometre taşı bazında süre uyumu
- FR PASAT 005 Aylık Müşteri Şikâyetleri Tablosu — 17 kolonuyla ekranda ve
  Excel çıktısı olarak (devreden dosyalar işaretli, aylık işlem toplamı,
  gönderim dağıtımı ve imza alanı dâhil)

**Belge üretimi**
- FR PASAT 007 Müşteri Şikâyet Formu
- FR PASAT 004 Ürün Değişim-İade Tutanağı
- FR PASAT 005 Ürün Değişim/İade ve Nakliye Bedelinin Ödenmesi Tutanağı
- İnceleme Tutanağı (haklı bulunmayan dosyalar için)
- Müşteri Bilgilendirme Formu

Belgeler A4 yerleşiminde ekranda açılır; tarayıcının **Yazdır → PDF olarak
kaydet** seçeneğiyle PDF üretilir. Bu yöntem Türkçe karakterlerde yazı tipi
gömme sorunu yaşatmaz.

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
    belge/[id]/             resmî belge çıktıları (A4)
    api/ek/[id]/            yetkili dosya servisi
    api/rapor/aylik/        Excel çıktısı
  components/               ortak arayüz bileşenleri, grafikler
  lib/
    db/schema.sql           veritabanı şeması (24 tablo)
    db/driver.ts            node:sqlite sürücü katmanı (işlem, SAVEPOINT, parametre normalleştirme)
    db/index.ts             bağlantı ve sorgu yardımcıları
    domain.ts               durumlar, talepler, belge türleri, SLA günleri
    workflow.ts             görev kartı kataloğu, imza zincirleri, itiraz eşikleri
    dates.ts                iş günü ve SLA hesapları
    roles.ts                roller ve yetki matrisi
  server/                   iş mantığı (sunucuya özel)
    process.ts              süreç motoru — tüm iş akışı adımları
    complaints.ts           kayıt oluşturma ve sorgular
    documents.ts            belgeler ve imza zinciri
    lab.ts                  numune ve analiz
    notify.ts               bildirim şablonları ve gönderim
    providers.ts            SMS / e-posta sağlayıcı adaptörleri
    stats.ts                performans istatistikleri
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
```

### Tek sorumlu ve sıra kuralı

Sistemin temel kuralı: **her süreç adımı tek bir kişinin üzerindedir ve adımlar
sırayla işlenir.** Rol yetkisi yalnızca "bu adıma kim atanabilir" sorusunu
yanıtlar; işi fiilen yapma hakkı görev kartının üzerindeki kişiye aittir.

Bir adımı işleyebilmek için dört koşul birlikte sağlanmalıdır
(`src/server/task-guard.ts` — `requireTaskTurn`):

1. Kullanıcı dosyanın fabrikasına erişebiliyor,
2. adım bu dosyada açık,
3. öncül adımların tamamı kapanmış (sırası gelmiş),
4. işlemi yapan kişi, görevin atanmış sorumlusu.

Arayüz aynı kuralı gösterir: bir adımın formu ve düğmeleri yalnızca sırası
gelmiş ve sorumlusu o kişi olan adımda çıkar. Diğer personel adımı görür ama
"Sıra: Ad Soyad" yazar; sırası gelmeyen adımda "Sırada bekliyor — önce şu adım"
görünür. Sunucu tarafı, arayüz ne gösterirse göstersin kuralı yeniden uygular.

Adımların sırası `src/lib/workflow.ts` içindeki `dependsOn` alanlarında
tanımlıdır. Dosyada bulunmayan öncül sağlanmış sayılır; böylece haklı, haksız
ve itiraz dalları tek bir bağımlılık grafiğiyle yürür.

**Fabrika Müdürünün rolü** süreci yönetmektir, adımları işlemek değil: şikâyeti
görür, inceleme ekibini kurar ya da dosyayı daha yakın fabrikaya yönlendirir,
bir adımın sorumlusunu değiştirir (izin, rapor, görevden ayrılma hâllerinde),
gerekmeyen bir adımı atlar ve süreci izler. Talimatın doğrudan kendisine
verdiği üç iş kendisinde kalır: **tutanağın son onayı** (imza zincirinin 6.
sırası), **itirazın Daire Başkanlığına gönderilmesi** ve **dosyanın
kapatılması**. Bunların dışındaki hiçbir adımı kendi işleyemez.

Bir adım görev kartından elle "tamamlandı" yapılamaz; tamamlanma yalnızca o
adımın kendi formu işlendiğinde gerçekleşir.

#### Diğer yetki kuralları

12 fabrika unvanı, Genel Müdürlük üst yönetimi, 5 daire başkanlığı ve sistem
yöneticisi için ayrı yetkiler tanımlıdır (`src/lib/roles.ts`):

- Laboratuvar Sorumlusu analiz girer, tutanak **imzalayamaz**
- Ambar Şefi iade/değişimi kaydeder; **nakliye bedelini Muhasebe öder** (md. 6-b)
- Ambar Şefi imza zincirinin ilk halkasıdır, karar veremez
- Müdür yardımcıları imza zincirinin üyeleridir; Teknik ve Ziraat ayrıca
  inceleme ekibine girip ekip lideri olabilir (md. 3)
- Daire Başkanı yalnızca **kendi dairesine** düşen itirazı karara bağlar
- Fabrika personeli yalnızca **kendi fabrikasının** dosyalarını görür
- Genel Müdürlük tüm fabrikaları görür, fabrika süreç işlemlerini yapamaz
- Yeniden atama listesinde yalnızca o adımı yürütme yetkisi olan personel
  görünür; iş yapamayacak bir kişiye adım atanamaz

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

**Uçtan uca senaryo testi.** Bir şikâyeti halka açık formdan açar ve talimatın
tüm akışını arayüz üzerinden yürütür: ekip oluşturma, yerinde inceleme, numune,
analiz, tutanak, 6 adımlı imza zinciri, Fabrika Müdürü onayı, düzeltici
faaliyet, iade + nakliye bedeli, resmî yazı, müşteri bilgilendirmesi, kapanış ve
müşteri tarafındaki sonucun doğrulanması.

```bash
npm install -D playwright && npx playwright install chromium
npm run dev                          # ayrı bir terminalde
npm run test:senaryo                 # varsayılan http://localhost:3000
npm run test:senaryo -- http://localhost:3100   # başka adres
```

Test 31 kontrolün tamamını doğrular ve başarısızlık hâlinde sıfırdan farklı
çıkış kodu döndürür.

**Tek sorumlu ve sıra kuralı testi.** Süreç adımlarının tek kişide durduğunu ve
sırayla işlendiğini doğrular: adımın sorumlusu "Sıra sizde" görür ve düğmesi
vardır, aynı fabrikadaki başka personel aynı adımda düğme görmez ve adımın
kimde olduğunu okur, sırası gelmeyen adım hangi adımı beklediğini yazar, Fabrika
Müdürü başkasının adımının formunu görmez ama sorumluyu değiştirebilir, başka
fabrikanın personeli dosyayı hiç açamaz.

```bash
npm run test:sahiplik                       # varsayılan http://localhost:3100
TEST_BASE=http://localhost:3000 npm run test:sahiplik
```

Test, dosyayı veritabanından kendisi seçer; öncesinde **Tanımlar > Demo Verisi**
ekranından demo verisi üretilmiş olmalıdır. 17 kontrolü doğrular.

> Kurumsal ağ arkasında `npx playwright install chromium` komutu tarayıcıyı
> indiremeyebilir (indirme `playwright.azureedge.net` üzerinden yapılır). Bu
> yalnızca senaryo testini etkiler; uygulamanın kendisi çalışmaya devam eder.

## Talimattan sapmalar ve eklemeler

Aşağıdakiler TL PASAT 004'te açıkça yer almayan, sistemin tutarlı çalışması için
eklenen unsurlardır. Kurum onayıyla değiştirilebilirler.

1. **İnceleme Tutanağı (FR PASAT 008 olarak kodlandı).** Talimatın ekindeki iki
   tutanak yalnızca iade/değişim hâllerini kapsar. Şikâyetin haklı bulunmadığı
   dosyalarda inceleme sonucunu ve gerekçesini imza altına alacak bir belge
   bulunmadığından, aynı 6 imzalı zincirle onaylanan bir İnceleme Tutanağı
   eklenmiştir.

2. **Kararın tutanakla kesinleşmesi.** Haklı/haksız kararı ayrı bir adım
   değildir; tutanağa yazılır ve Fabrika Müdürü onayıyla kesinleşir. Bu,
   md. 4'teki "düzenlenen tutanaklar fabrika müdürünün onayından sonra…"
   ifadesine uygundur.

3. **Daire itirazı kabul ettiğinde işlem süresinin yeniden başlaması.** Talimat
   iade/değişim için şikâyet tarihinden itibaren 5 iş günü öngörür. Daire
   Başkanlığı kararı bu süreden sonra geldiğinde süre fiilen imkânsız hâle
   gelir; bu nedenle karar kabul edildiğinde 5 iş günlük süre **daire kararı
   tarihinden** yeniden başlatılır ve bu yeniden başlatma olay günlüğüne ayrıca
   işlenir. Ayrıca iade/değişim için gereken FR PASAT 004/005 tutanağının
   düzenlenmesi ve imza zinciri yeniden açılır.

4. **SMS ile telefon doğrulaması.** Halka açık formda sahte kayıt önlenmesi ve
   bilgilendirme SMS'lerinin doğru numaraya ulaşması için zorunludur; Tanımlar
   sayfasından kapatılabilir.

5. **Şikâyet numarası biçimi** `YIL-FABRİKAKODU-SIRA` (örnek `2026-ANK-0001`).
   Numara üretici fabrikadan alınır ve dosya başka fabrikaya yönlendirilse bile
   değişmez; böylece müşteriye verilen numara kalıcı olur.

6. **"Daha yakın fabrika" önerisi**, müşterinin seçtiği ilin merkez koordinatı
   ile 14 fabrikanın koordinatları arasındaki kuş uçuşu mesafeden hesaplanır.
   Öneridir; yönlendirme kararı her hâlükârda Fabrika Müdürünündür.

7. **Laboratuvar spesifikasyon değerleri** TS 861 kristal şeker standardı ve
   yaygın kurum içi kabul kriterlerine göre ön tanımlı gelir. Kurumun geçerli
   spesifikasyonlarıyla karşılaştırılıp Tanımlar sayfasından güncellenmelidir.

8. **PDF üretimi** tarayıcının yazdırma işleviyle yapılır. Sunucu tarafında
   doğrudan PDF üretimi gerekirse Playwright/Puppeteer ile `/belge/[id]`
   sayfasının çıktısı alınabilir.

9. **Nakliye bedeli ayrı bir adımdır.** Talimat md. 6'da iade/değişim ile
   nakliye bedelinin ödenmesi aynı maddede geçer. Fiiliyatta iade/değişimi
   ambar, ödemeyi muhasebe yapar; her adımın sorumlusu tek kişi olsun diye iki
   iş ayrı görev kartına bölünmüştür. Her ikisi de şikâyet tarihinden itibaren
   5 iş günü içinde tamamlanır ve ikisi de kapanmadan dosya kapatılamaz.

10. **Fabrika Müdürü adımları kendi işlemez.** Talimat kimin hangi işi yapacağını
    unvan düzeyinde belirler ama bir üstün astının işini yapıp yapamayacağına
    değinmez. Sorumluluk zincirinin izlenebilir kalması için müdüre yalnızca
    talimatın doğrudan kendisine verdiği üç iş bırakılmıştır (tutanak onayı,
    itirazın gönderilmesi, dosyanın kapatılması); personelin müsait olmadığı
    hâllerde adımı başka bir personele **yeniden atar**. Bu kurumsal bir
    tercihtir; kurum isterse müdüre gerekçeli "vekâleten işle" yetkisi
    tanınabilir.

---

© Türkiye Şeker Fabrikaları A.Ş.
