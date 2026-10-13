/* Türkşeker kuruluş yapısı: fabrikalar, iller, daire başkanlıkları. */

/** 14 şeker fabrikası. Koordinatlar fabrika/ilçe merkezlerine göredir ve
 *  "daha yakın fabrika" önerisinin (TL PASAT 004 md. 2) hesabında kullanılır. */
export const FABRIKALAR = [
  { code: "AGR", name: "Ağrı Şeker Fabrikası",                    short: "Ağrı",      province: "Ağrı",      lat: 39.7191, lon: 43.0503 },
  { code: "ANK", name: "Ankara Şeker Fabrikası",                  short: "Ankara",    province: "Ankara",    lat: 39.9496, lon: 32.6830 },
  { code: "BUR", name: "Burdur Şeker Fabrikası",                  short: "Burdur",    province: "Burdur",    lat: 37.7206, lon: 30.2917 },
  { code: "ELZ", name: "Elazığ Şeker Fabrikası",                  short: "Elazığ",    province: "Elazığ",    lat: 38.6744, lon: 39.2217 },
  { code: "ERC", name: "Erciş Şeker Fabrikası",                   short: "Erciş",     province: "Van",       lat: 39.0269, lon: 43.3586 },
  { code: "ERG", name: "Ereğli Şeker Fabrikası",                  short: "Ereğli",    province: "Konya",     lat: 37.5133, lon: 34.0486 },
  { code: "ESK", name: "Eskişehir Şeker Fabrikası (Kazım Taşkent)", short: "Eskişehir", province: "Eskişehir", lat: 39.7767, lon: 30.5206 },
  { code: "ILG", name: "Ilgın Şeker Fabrikası",                   short: "Ilgın",     province: "Konya",     lat: 38.2786, lon: 31.9125 },
  { code: "KRS", name: "Kars Şeker Fabrikası",                    short: "Kars",      province: "Kars",      lat: 40.6013, lon: 43.0897 },
  { code: "KAS", name: "Kastamonu Şeker Fabrikası",               short: "Kastamonu", province: "Kastamonu", lat: 41.3764, lon: 33.7753 },
  { code: "MLT", name: "Malatya Şeker Fabrikası",                 short: "Malatya",   province: "Malatya",   lat: 38.3486, lon: 38.3061 },
  { code: "SUS", name: "Susurluk Şeker Fabrikası",                short: "Susurluk",  province: "Balıkesir", lat: 39.9108, lon: 28.1575 },
  { code: "USK", name: "Uşak Şeker Fabrikası",                    short: "Uşak",      province: "Uşak",      lat: 38.6783, lon: 29.4058 },
  { code: "YOZ", name: "Yozgat Şeker Fabrikası",                  short: "Yozgat",    province: "Yozgat",    lat: 39.8108, lon: 35.1897 },
];

/** 81 il merkezi koordinatı. En yakın fabrika seed sırasında hesaplanır. */
export const ILLER = [
  ["01", "Adana", 37.0000, 35.3213], ["02", "Adıyaman", 37.7648, 38.2786],
  ["03", "Afyonkarahisar", 38.7569, 30.5387], ["04", "Ağrı", 39.7191, 43.0503],
  ["05", "Amasya", 40.6499, 35.8353], ["06", "Ankara", 39.9334, 32.8597],
  ["07", "Antalya", 36.8969, 30.7133], ["08", "Artvin", 41.1828, 41.8183],
  ["09", "Aydın", 37.8560, 27.8416], ["10", "Balıkesir", 39.6484, 27.8826],
  ["11", "Bilecik", 40.1426, 29.9793], ["12", "Bingöl", 38.8847, 40.4982],
  ["13", "Bitlis", 38.4006, 42.1095], ["14", "Bolu", 40.7392, 31.6089],
  ["15", "Burdur", 37.7206, 30.2917], ["16", "Bursa", 40.1826, 29.0665],
  ["17", "Çanakkale", 40.1553, 26.4142], ["18", "Çankırı", 40.6013, 33.6134],
  ["19", "Çorum", 40.5506, 34.9556], ["20", "Denizli", 37.7765, 29.0864],
  ["21", "Diyarbakır", 37.9144, 40.2306], ["22", "Edirne", 41.6771, 26.5557],
  ["23", "Elazığ", 38.6810, 39.2264], ["24", "Erzincan", 39.7500, 39.5000],
  ["25", "Erzurum", 39.9000, 41.2700], ["26", "Eskişehir", 39.7767, 30.5206],
  ["27", "Gaziantep", 37.0662, 37.3833], ["28", "Giresun", 40.9128, 38.3895],
  ["29", "Gümüşhane", 40.4603, 39.4814], ["30", "Hakkâri", 37.5744, 43.7408],
  ["31", "Hatay", 36.2025, 36.1606], ["32", "Isparta", 37.7648, 30.5566],
  ["33", "Mersin", 36.8000, 34.6333], ["34", "İstanbul", 41.0082, 28.9784],
  ["35", "İzmir", 38.4237, 27.1428], ["36", "Kars", 40.6013, 43.0897],
  ["37", "Kastamonu", 41.3764, 33.7753], ["38", "Kayseri", 38.7312, 35.4787],
  ["39", "Kırklareli", 41.7333, 27.2167], ["40", "Kırşehir", 39.1425, 34.1709],
  ["41", "Kocaeli", 40.7654, 29.9408], ["42", "Konya", 37.8746, 32.4932],
  ["43", "Kütahya", 39.4167, 29.9833], ["44", "Malatya", 38.3552, 38.3095],
  ["45", "Manisa", 38.6191, 27.4289], ["46", "Kahramanmaraş", 37.5858, 36.9371],
  ["47", "Mardin", 37.3212, 40.7245], ["48", "Muğla", 37.2153, 28.3636],
  ["49", "Muş", 38.7432, 41.5064], ["50", "Nevşehir", 38.6939, 34.6857],
  ["51", "Niğde", 37.9667, 34.6833], ["52", "Ordu", 40.9839, 37.8764],
  ["53", "Rize", 41.0201, 40.5234], ["54", "Sakarya", 40.7569, 30.3781],
  ["55", "Samsun", 41.2867, 36.3300], ["56", "Siirt", 37.9333, 41.9500],
  ["57", "Sinop", 42.0231, 35.1531], ["58", "Sivas", 39.7477, 37.0179],
  ["59", "Tekirdağ", 40.9833, 27.5167], ["60", "Tokat", 40.3167, 36.5500],
  ["61", "Trabzon", 41.0027, 39.7168], ["62", "Tunceli", 39.1079, 39.5401],
  ["63", "Şanlıurfa", 37.1591, 38.7969], ["64", "Uşak", 38.6823, 29.4082],
  ["65", "Van", 38.4891, 43.4089], ["66", "Yozgat", 39.8181, 34.8147],
  ["67", "Zonguldak", 41.4564, 31.7987], ["68", "Aksaray", 38.3687, 34.0370],
  ["69", "Bayburt", 40.2552, 40.2249], ["70", "Karaman", 37.1759, 33.2287],
  ["71", "Kırıkkale", 39.8468, 33.5153], ["72", "Batman", 37.8812, 41.1351],
  ["73", "Şırnak", 37.5164, 42.4611], ["74", "Bartın", 41.6344, 32.3375],
  ["75", "Ardahan", 41.1105, 42.7022], ["76", "Iğdır", 39.9237, 44.0450],
  ["77", "Yalova", 40.6500, 29.2667], ["78", "Karabük", 41.2061, 32.6204],
  ["79", "Kilis", 36.7184, 37.1212], ["80", "Osmaniye", 37.0742, 36.2464],
  ["81", "Düzce", 40.8438, 31.1565],
].map(([code, name, lat, lon]) => ({ code, name, lat, lon }));

/** Genel Müdürlük daire başkanlıkları (TL PASAT 004 md. 5 ve 6).
 *  can_decide: haksız bulunan şikâyetlerde itirazı karara bağlama yetkisi. */
export const DAIRELER = [
  { code: "PAZARLAMA_SATIS",    name: "Pazarlama ve Satış Daire Başkanlığı",             canDecide: 1 },
  { code: "PERAKENDE_LOJISTIK", name: "Perakende Satışlar ve Lojistik Daire Başkanlığı", canDecide: 1 },
  { code: "SEKER_URETIM",       name: "Şeker Üretim Daire Başkanlığı",                   canDecide: 0 },
  { code: "MALI_ISLER",         name: "Mali İşler ve Muhasebe Daire Başkanlığı",         canDecide: 0 },
  { code: "STRATEJI",           name: "Strateji Geliştirme Daire Başkanlığı",            canDecide: 0 },
];
