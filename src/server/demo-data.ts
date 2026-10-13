/* Demo verisi için gerçekçi müşteri, konu ve gerekçe metinleri. */

export const FIRMALAR = [
  ["Ak Gıda Sanayi ve Ticaret Ltd. Şti.", "Satın Alma Müdürü"],
  ["Anadolu Bisküvi A.Ş.", "Kalite Güvence Sorumlusu"],
  ["Marmara Şekerleme San. Tic. A.Ş.", "Üretim Müdürü"],
  ["Ege Meşrubat ve Gıda A.Ş.", "Tedarik Zinciri Uzmanı"],
  ["Karadeniz Fırıncılık Ltd. Şti.", "İşletme Sahibi"],
  ["Toros Yem Sanayi A.Ş.", "Hammadde Sorumlusu"],
  ["Güneydoğu Helva ve Tahin Ltd. Şti.", "Fabrika Müdürü"],
  ["İç Anadolu Süt Ürünleri Koop.", "Yönetim Kurulu Üyesi"],
  ["Trakya Gıda Toptan Tic. Ltd. Şti.", "Depo Sorumlusu"],
  ["Doğu Anadolu Besicilik A.Ş.", "Çiftlik Müdürü"],
  ["Başkent Pastacılık San. Tic. Ltd.", "Üretim Şefi"],
  ["Akdeniz Reçel ve Konserve A.Ş.", "Kalite Müdürü"],
  ["Batı Anadolu Market Zinciri A.Ş.", "Kategori Yöneticisi"],
  ["Sakarya Çikolata San. Ltd. Şti.", "Ar-Ge Sorumlusu"],
  ["Konya Ovası Tarım Koop.", "Muhasebe Yetkilisi"],
  ["Samsun Toptan Gıda Pazarlama A.Ş.", "Satın Alma Uzmanı"],
  ["Kayseri Mandıra ve Süt A.Ş.", "Üretim Planlama"],
  ["Bursa Hazır Gıda Ltd. Şti.", "Lojistik Sorumlusu"],
  ["Mersin Limanı Gıda İhracat A.Ş.", "İhracat Müdürü"],
  ["Erzurum Besi Çiftliği Ltd. Şti.", "İşletme Müdürü"],
] as const;

export const YETKILILER = [
  "Serkan Yılmaz", "Ayşe Demir", "Mehmet Kaya", "Fatma Şahin", "Emre Çelik",
  "Zeynep Yıldız", "Murat Arslan", "Elif Doğan", "Hakan Kılıç", "Derya Aslan",
  "Oğuz Çetin", "Pınar Kara", "Levent Koç", "Seda Kurt", "Burak Özkan",
  "Tuğba Şimşek", "Cem Polat", "Yasemin Korkmaz", "Alper Erdoğan", "Esra Bulut",
];

export interface DemoCase {
  /** Kategori adı — veritabanındaki ada birebir eşleşir. */
  kategori: string;
  konu: string;
  aciklama: string;
  /** Haklı bulunursa inceleme sonucu. */
  hakliGerekce: string;
  /** Haksız bulunursa inceleme sonucu. */
  haksizGerekce: string;
  /** Analiz parametre kodu -> uygun olmayan değer / uygun değer. */
  analiz?: { kod: string; kotu: string; iyi: string };
}

export const SENARYOLAR: DemoCase[] = [
  {
    kategori: "Topaklanma / sertleşme",
    konu: "50 kg çuvallarda yaygın topaklanma ve sertleşme",
    aciklama:
      "Teslim alınan partinin yaklaşık dörtte birinde çuval içinde taş gibi topaklar oluştu. " +
      "Ürün dozaj hattında elenemiyor, hat tıkanıyor.",
    hakliGerekce:
      "Alınan numunelerde nem oranı %0,09 ölçülmüş olup TS 861 standardının öngördüğü en çok " +
      "%0,06 sınırının üzerindedir. Topaklanmanın üretim sırasındaki kurutma yetersizliğinden " +
      "kaynaklandığı tespit edilmiştir.",
    haksizGerekce:
      "Alınan numunelerde nem oranı %0,04 ölçülmüş olup standart sınırların içindedir. " +
      "Firma deposunda yapılan incelemede ürünün nemli zemin üzerinde ve dış duvara dayalı " +
      "istiflendiği, depo bağıl neminin %78 olduğu tespit edilmiştir. Topaklanmanın depolama " +
      "koşullarından kaynaklandığı değerlendirilmiştir.",
    analiz: { kod: "NEM", kotu: "0,09", iyi: "0,04" },
  },
  {
    kategori: "Renk bozukluğu / sararma",
    konu: "Kristal şekerde sararma ve renk farkı",
    aciklama: "Önceki partilere göre belirgin şekilde sarı tonda. Beyaz çikolata üretiminde kullanılamıyor.",
    hakliGerekce:
      "Numunede ICUMSA renk değeri 61 IU ölçülmüştür; kabul sınırı en çok 45 IU'dur. " +
      "Rafinasyon aşamasındaki filtrasyon arızasının partiyi etkilediği tespit edilmiştir.",
    haksizGerekce:
      "Numunede ICUMSA renk değeri 38 IU ölçülmüş olup 45 IU sınırının altındadır. " +
      "Üründe standart dışı bir renk değeri saptanmamıştır.",
    analiz: { kod: "RENK", kotu: "61", iyi: "38" },
  },
  {
    kategori: "Yabancı madde (metal, cam, plastik)",
    konu: "Paketli şekerde plastik parça tespiti",
    aciklama:
      "Müşterimiz 1 kg paket içinde yaklaşık 1 cm boyunda sert plastik parça bulduğunu bildirdi. " +
      "Parça tarafımızda muhafaza edilmektedir.",
    hakliGerekce:
      "Firmadan teslim alınan yabancı madde incelenmiş; paketleme hattındaki besleme hunisi " +
      "sıyırıcı plakasının kopan parçası olduğu tespit edilmiştir. Hat durdurulmuş, metal/plastik " +
      "dedektörü kalibrasyonu yenilenmiştir.",
    haksizGerekce:
      "Teslim alınan yabancı madde, fabrikamız hatlarında kullanılmayan bir malzeme türündedir. " +
      "Aynı parti numunelerinde yabancı madde saptanmamıştır. Bulaşmanın fabrika dışında " +
      "gerçekleştiği değerlendirilmiştir.",
    analiz: { kod: "YABANCI", kotu: "Plastik parça tespit edildi", iyi: "Tespit edilmedi" },
  },
  {
    kategori: "Çuval / paket yırtılması",
    konu: "Sevkiyatta 40 çuvalın yırtılması ve ürün kaybı",
    aciklama: "Araç boşaltımında 40 çuvalın dikiş yerlerinden yırtıldığı, ürünün döküldüğü görüldü.",
    hakliGerekce:
      "Aynı parti çuvalların dikiş mukavemeti ölçülmüş, üç örnekte dikişin standart altında " +
      "olduğu görülmüştür. Çuval tedarikçisine uygunsuzluk bildirimi yapılmıştır.",
    haksizGerekce:
      "Araç ve boşaltma kayıtları incelenmiş; çuvalların forklift çatalıyla doğrudan temas " +
      "ettiği, paletleme yapılmadığı görülmüştür. Hasarın boşaltma yönteminden kaynaklandığı " +
      "değerlendirilmiştir.",
  },
  {
    kategori: "Eksik teslim / tonaj farkı",
    konu: "İrsaliyedeki tonaj ile teslim alınan miktar arasında fark",
    aciklama: "İrsaliyede 27.000 kg yazıyor, kantar fişimiz 26.140 kg gösteriyor. 860 kg eksik.",
    hakliGerekce:
      "Fabrika kantar kayıtları ile firma kantar fişi karşılaştırılmış; fabrika kantarının son " +
      "muayene tarihinin geçtiği ve 0,9 ton sapma gösterdiği tespit edilmiştir. Kantar " +
      "kalibrasyonu yenilenmiştir.",
    haksizGerekce:
      "Fabrika kantarı muayeneli olup sapma göstermemektedir. Firma kantarının muayene " +
      "belgesinin bulunmadığı tespit edilmiş; tonaj farkının firma kantarından kaynaklandığı " +
      "değerlendirilmiştir.",
  },
  {
    kategori: "Küflenme / mikrobiyolojik bulaşma",
    konu: "Pelet küspede küflenme ve küf kokusu",
    aciklama: "Depoya alınan peletlerde yüzeysel beyaz küflenme ve küf kokusu var. Hayvanlar yemi tüketmiyor.",
    hakliGerekce:
      "Numunede maya-küf sayımı 180 kob/g ölçülmüş olup kabul sınırı en çok 10 kob/g'dir. " +
      "Pelet soğutma hattındaki arızanın nem oranını yükselttiği tespit edilmiştir.",
    haksizGerekce:
      "Numunede maya-küf sayımı 6 kob/g, nem %10,4 ölçülmüştür; her iki değer de sınırların " +
      "içindedir. Firma deposunda havalandırma bulunmadığı ve ürünün açık alanda bekletildiği " +
      "görülmüştür.",
    analiz: { kod: "MAYA_KUF", kotu: "180", iyi: "6" },
  },
  {
    kategori: "Polarizasyon / şeker oranı düşüklüğü",
    konu: "Melasta toplam şeker oranının sözleşme değerinin altında olması",
    aciklama: "Sözleşmede en az %46 toplam şeker belirtilmişti; kendi analizimiz %43,2 çıktı.",
    hakliGerekce:
      "Fabrika laboratuvarı analizinde toplam şeker oranı %43,6 ölçülmüştür; sözleşmede " +
      "taahhüt edilen %46 değerinin altındadır. Kampanya sonu melas kalitesindeki düşüşün " +
      "sevkiyata yansıdığı tespit edilmiştir.",
    haksizGerekce:
      "Fabrika laboratuvarı ve bağımsız akredite laboratuvar analizlerinde toplam şeker oranı " +
      "sırasıyla %46,8 ve %46,4 ölçülmüştür. Sözleşme değeri karşılanmaktadır.",
    analiz: { kod: "TOPLAM_SEKER", kotu: "43,6", iyi: "46,8" },
  },
  {
    kategori: "Nakliye kaynaklı hasar",
    konu: "Big-bag torbaların nakliye sırasında ıslanması",
    aciklama: "Yağmurda branda çekilmeden taşınan 12 big-bag ıslandı, alt kısımları sertleşti.",
    hakliGerekce:
      "Sevkiyat fabrikamız organizasyonuyla yapılmış olup nakliye firmasının brandasız yükleme " +
      "yaptığı tespit edilmiştir. Sorumluluk fabrikamıza ait sevkiyat organizasyonundadır.",
    haksizGerekce:
      "Satış sözleşmesi fabrika teslim (FCA) şartlı olup nakliye firmanız tarafından " +
      "organize edilmiştir. Yükleme tutanağında ürünün kuru ve hasarsız teslim edildiği " +
      "taraflarca imzalanmıştır.",
  },
  {
    kategori: "Eksik gramaj",
    konu: "1 kg paketlerde gramaj eksikliği",
    aciklama: "Rastgele seçtiğimiz 20 paketin 14'ü 985 g altında çıktı.",
    hakliGerekce:
      "Aynı partiden alınan 30 paketin ortalama ağırlığı 983 g ölçülmüştür. Paketleme " +
      "hattındaki dozaj teraziisinin kalibrasyon dışı kaldığı tespit edilmiştir.",
    haksizGerekce:
      "Aynı partiden alınan 30 paketin ortalama ağırlığı 1.002 g olup yasal tolerans " +
      "sınırları içindedir. Ölçümlerinizde kullanılan terazinin muayeneli olmadığı görülmüştür.",
  },
  {
    kategori: "Tat / koku bozukluğu",
    konu: "Küp şekerde yabancı koku",
    aciklama: "Kolilerden çıkan küp şekerlerde kimyasal benzeri bir koku var.",
    hakliGerekce:
      "Duyusal değerlendirmede yabancı koku teyit edilmiştir. Ambalaj deposunda aynı alanda " +
      "bekletilen temizlik kimyasallarının koku transferine yol açtığı tespit edilmiş; depo " +
      "ayrımı yapılmıştır.",
    haksizGerekce:
      "Fabrika ve bağımsız duyusal panel değerlendirmesinde yabancı koku saptanmamıştır. " +
      "Firma deposunda aynı rafta deterjan bulunduğu görülmüştür.",
    analiz: { kod: "KOKU_TAT", kotu: "Yabancı koku tespit edildi", iyi: "Kendine has, yabancı koku yok" },
  },
  {
    kategori: "Ambalaj baskı / etiket hatası",
    konu: "Paket üzerinde son tüketim tarihi okunamıyor",
    aciklama: "5 kg paketlerin yaklaşık yarısında tarih baskısı silik, market raf kontrolünden geçmiyor.",
    hakliGerekce:
      "Parti örnekleri incelenmiş; mürekkep püskürtmeli kodlama ünitesinin basınç düşüşü " +
      "nedeniyle silik baskı yaptığı tespit edilmiştir.",
    haksizGerekce:
      "Parti örneklerinde baskı netliği uygun bulunmuştur. Silikliğin nakliye sırasında " +
      "streç filmin baskı yüzeyine sürtünmesinden kaynaklandığı değerlendirilmiştir.",
  },
  {
    kategori: "Gecikmeli teslim",
    konu: "Sözleşmeli sevkiyatın 9 gün gecikmesi",
    aciklama: "15 Eylül teslim tarihli 100 ton sevkiyat 24 Eylül'de yapıldı; üretim planımız aksadı.",
    hakliGerekce:
      "Sevkiyat planı incelenmiş; fabrika ambar sevk programındaki aksama nedeniyle gecikme " +
      "yaşandığı tespit edilmiştir.",
    haksizGerekce:
      "Sevk emri firmanızın ödeme talimatının gecikmesi nedeniyle açılamamıştır. " +
      "Sözleşmenin 7. maddesi uyarınca teslim süresi ödemenin tamamlanmasından itibaren işler.",
  },
];
