-- ===========================================================================
-- Türkşeker Müşteri Şikâyet Takip Sistemi — Veritabanı Şeması (SQLite)
-- Dayanak: TL PASAT 004 "Müşteri Şikâyetlerinde Uygulamalar" (24.09.2026)
-- ===========================================================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- --- Kuruluş yapısı --------------------------------------------------------

CREATE TABLE IF NOT EXISTS factories (
  id            INTEGER PRIMARY KEY,
  code          TEXT    NOT NULL UNIQUE,          -- ANK, AGR, BUR ...
  name          TEXT    NOT NULL,                 -- "Ankara Şeker Fabrikası"
  short_name    TEXT    NOT NULL,                 -- "Ankara"
  province      TEXT    NOT NULL,                 -- bulunduğu il
  address       TEXT,
  phone         TEXT,
  email         TEXT,
  lat           REAL,
  lon           REAL,
  is_active     INTEGER NOT NULL DEFAULT 1
);

-- 81 il -> en yakın fabrika eşlemesi. Şikâyette "daha yakın fabrika"
-- önerisi (TL PASAT 004 md. 2) bu tablodan üretilir.
CREATE TABLE IF NOT EXISTS provinces (
  code                TEXT PRIMARY KEY,           -- "06"
  name                TEXT NOT NULL,              -- "Ankara"
  nearest_factory_id  INTEGER REFERENCES factories(id)
);

-- Genel Müdürlük daire başkanlıkları
CREATE TABLE IF NOT EXISTS departments (
  id          INTEGER PRIMARY KEY,
  code        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  -- İtiraz kararı verme yetkisi olan daire mi (TL PASAT 004 md. 5)
  can_decide  INTEGER NOT NULL DEFAULT 0,
  is_active   INTEGER NOT NULL DEFAULT 1
);

-- --- Kullanıcılar ve yetkiler ---------------------------------------------

CREATE TABLE IF NOT EXISTS users (
  id             INTEGER PRIMARY KEY,
  username       TEXT    NOT NULL UNIQUE,
  password_hash  TEXT    NOT NULL,
  full_name      TEXT    NOT NULL,
  title          TEXT    NOT NULL,                -- görünen unvan
  role           TEXT    NOT NULL,                -- bkz. src/lib/roles.ts
  factory_id     INTEGER REFERENCES factories(id),
  department_id  INTEGER REFERENCES departments(id),
  email          TEXT,
  phone          TEXT,
  is_active      INTEGER NOT NULL DEFAULT 1,
  is_demo        INTEGER NOT NULL DEFAULT 0,      -- demo rol değiştiricide görünür
  last_login_at  TEXT,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_users_factory ON users(factory_id);
CREATE INDEX IF NOT EXISTS idx_users_role    ON users(role);

CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at  TEXT NOT NULL,
  ip          TEXT,
  user_agent  TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- --- Tanımlar --------------------------------------------------------------

CREATE TABLE IF NOT EXISTS products (
  id            INTEGER PRIMARY KEY,
  name          TEXT    NOT NULL,
  -- PAKETLI_SEKER | DOKME_SEKER | MELAS | POSA
  product_group TEXT    NOT NULL,
  packaging     TEXT,                             -- "50 kg çuval", "1 kg paket"
  sort_order    INTEGER NOT NULL DEFAULT 0,
  is_active     INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS complaint_categories (
  id          INTEGER PRIMARY KEY,
  name        TEXT    NOT NULL,
  -- URUN_KALITE | AMBALAJ | MIKTAR | GIDA_GUVENLIGI | TESLIM | TICARI | DIGER
  family      TEXT    NOT NULL,
  -- Gıda güvenliği ihbarı sayılır, FSSC 22000 düzeltici faaliyet zorunlu
  is_critical INTEGER NOT NULL DEFAULT 0,
  needs_lab   INTEGER NOT NULL DEFAULT 0,         -- varsayılan olarak analiz gerektirir
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   INTEGER NOT NULL DEFAULT 1
);

-- Resmî tatiller — iş günü bazlı SLA hesabında kullanılır
CREATE TABLE IF NOT EXISTS holidays (
  date  TEXT PRIMARY KEY,                         -- YYYY-MM-DD
  name  TEXT NOT NULL,
  half_day INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  label       TEXT,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Laboratuvar analiz parametre tanımları
CREATE TABLE IF NOT EXISTS lab_parameters (
  id             INTEGER PRIMARY KEY,
  code           TEXT NOT NULL UNIQUE,
  name           TEXT NOT NULL,
  unit           TEXT,
  product_group  TEXT,                            -- NULL ise tüm gruplar
  spec_min       REAL,
  spec_max       REAL,
  spec_text      TEXT,                            -- "yok", "tespit edilmedi"
  sort_order     INTEGER NOT NULL DEFAULT 0,
  is_active      INTEGER NOT NULL DEFAULT 1
);

-- --- Şikâyet ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS complaints (
  id                INTEGER PRIMARY KEY,
  complaint_no      TEXT    NOT NULL UNIQUE,      -- 2026-ANK-0001
  tracking_token    TEXT    NOT NULL UNIQUE,      -- SMS'teki takip linki
  -- WEB | TELEFON | EPOSTA | YAZILI | ELDEN  (aylık tablodaki "Kayıt türü")
  channel           TEXT    NOT NULL DEFAULT 'WEB',
  status            TEXT    NOT NULL DEFAULT 'YENI',

  -- Üretici fabrika (formdaki "ÜRETİCİ ŞEKER FABRİKASI")
  origin_factory_id INTEGER NOT NULL REFERENCES factories(id),
  -- Dosyayı yürüten fabrika; yönlendirme sonrası değişir
  factory_id        INTEGER NOT NULL REFERENCES factories(id),

  received_at       TEXT    NOT NULL,             -- şikâyet tarihi (SLA başlangıcı)
  received_by_id    INTEGER REFERENCES users(id), -- "Şikâyeti alan"

  -- Şikâyet sahibi
  customer_company  TEXT    NOT NULL,
  customer_name     TEXT,
  customer_title    TEXT,                         -- ünvan
  customer_phone    TEXT    NOT NULL,
  customer_email    TEXT,
  customer_address  TEXT,
  customer_province TEXT REFERENCES provinces(code),
  customer_tax_no   TEXT,

  -- Ürün bilgisi
  product_id        INTEGER REFERENCES products(id),
  product_name      TEXT    NOT NULL,             -- serbest metin yedeği
  product_group     TEXT    NOT NULL,
  packaging         TEXT,
  lot_no            TEXT,
  quantity_kg       REAL,                         -- şikâyete konu miktar
  invoice_no        TEXT,
  delivery_note_no  TEXT,
  contract_no       TEXT,
  delivery_date     TEXT,

  -- Şikâyet içeriği
  category_id       INTEGER REFERENCES complaint_categories(id),
  subject           TEXT    NOT NULL,             -- şikâyet konusu
  description       TEXT,
  -- IADE | DEGISIM | IADE_NAKLIYE | DEGISIM_NAKLIYE | BILGI | DIGER
  demand            TEXT    NOT NULL DEFAULT 'IADE',
  demands_freight   INTEGER NOT NULL DEFAULT 0,   -- nakliye bedeli talebi (md. 6-b)

  -- KVKK ve doğrulama
  kvkk_consent_at   TEXT,
  phone_verified_at TEXT,
  source_ip         TEXT,

  -- İş günü bazlı SLA kilometre taşları
  due_team_at       TEXT,   -- ekip kurma / yönlendirme     : +1 iş günü
  due_inspection_at TEXT,   -- inceleme + tutanak           : +3 iş günü
  due_resolution_at TEXT,   -- iade / değişim / nakliye     : +5 iş günü
  due_report_at     TEXT,   -- resmî yazı (işlem tarihinden): +3 iş günü

  -- Yönlendirme (md. 2)
  redirected_from_id INTEGER REFERENCES factories(id),
  redirected_at      TEXT,
  redirect_reason    TEXT,

  -- Ekip
  team_formed_at     TEXT,
  -- İnceleme
  visited_at         TEXT,
  inspection_note    TEXT,
  lab_required       INTEGER NOT NULL DEFAULT 0,
  lab_skip_reason    TEXT,   -- analiz alınmadıysa gerekçe (md. 4)

  -- Sonuç
  verdict            TEXT,   -- HAKLI | HAKSIZ
  verdict_reason     TEXT,   -- aylık tablo "İnceleme sonucu / gerekçe"
  verdict_at         TEXT,
  decision           TEXT,   -- aylık tablo "Karar / Yapılan işlem"

  -- İtiraz süreci (md. 5)
  escalated_at           TEXT,
  escalated_dept_id      INTEGER REFERENCES departments(id),
  escalation_due_at      TEXT,   -- +5 iş günü
  escalation_reason      TEXT,
  escalation_result      TEXT,   -- SIKAYET_HAKLI | SIKAYET_HAKSIZ
  escalation_note        TEXT,
  escalation_decided_at  TEXT,
  escalation_decided_by  INTEGER REFERENCES users(id),

  -- Mali / fiziki gerçekleşme (aylık tablo kolonları)
  returned_kg        REAL NOT NULL DEFAULT 0,
  exchanged_kg       REAL NOT NULL DEFAULT 0,
  refund_amount      REAL NOT NULL DEFAULT 0,     -- iade / mahsup bedeli (TL)
  freight_amount     REAL NOT NULL DEFAULT 0,     -- ödenen nakliye bedeli (TL)
  freight_paid_at    TEXT,                        -- nakliye bedelinin ödendiği tarih (md. 6-b)
  transaction_date   TEXT,                        -- işlem tarihi

  -- FSSC 22000 düzeltici faaliyet (md. 4)
  capa_started_at    TEXT,
  capa_no            TEXT,
  capa_note          TEXT,

  -- Resmî yazı dağıtımı (md. 6)
  letter_sent_at     TEXT,
  letter_no          TEXT,

  -- Müşteri bilgilendirmesi (md. 7)
  customer_informed_at TEXT,

  closed_at          TEXT,
  closing_note       TEXT,
  ref_note           TEXT,                        -- "Açıklama / Belge referansı"

  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_complaints_factory  ON complaints(factory_id, status);
CREATE INDEX IF NOT EXISTS idx_complaints_status   ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_received ON complaints(received_at);
CREATE INDEX IF NOT EXISTS idx_complaints_dept     ON complaints(escalated_dept_id);
CREATE INDEX IF NOT EXISTS idx_complaints_phone    ON complaints(customer_phone);

-- Olay günlüğü / denetim izi — şikâyetin tüm geçmişi
CREATE TABLE IF NOT EXISTS complaint_events (
  id            INTEGER PRIMARY KEY,
  complaint_id  INTEGER NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  type          TEXT    NOT NULL,
  title         TEXT    NOT NULL,
  note          TEXT,
  from_status   TEXT,
  to_status     TEXT,
  actor_id      INTEGER REFERENCES users(id),
  actor_label   TEXT,                             -- "Müşteri" gibi sistem dışı aktörler
  payload       TEXT,                             -- JSON
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_events_complaint ON complaint_events(complaint_id, id);

-- --- Ekip (md. 3) ----------------------------------------------------------

CREATE TABLE IF NOT EXISTS team_members (
  id            INTEGER PRIMARY KEY,
  complaint_id  INTEGER NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  user_id       INTEGER NOT NULL REFERENCES users(id),
  -- KALITE_ISLETME_KONTROL | TEKNIK_ISLETME | MUHASEBE | ZIRAAT
  unit          TEXT    NOT NULL,
  is_lead       INTEGER NOT NULL DEFAULT 0,
  assigned_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  assigned_by   INTEGER REFERENCES users(id),
  UNIQUE(complaint_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_team_complaint ON team_members(complaint_id);
CREATE INDEX IF NOT EXISTS idx_team_user      ON team_members(user_id);

-- --- İş görev kartları -----------------------------------------------------

CREATE TABLE IF NOT EXISTS tasks (
  id             INTEGER PRIMARY KEY,
  complaint_id   INTEGER NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  code           TEXT    NOT NULL,                -- bkz. src/lib/workflow.ts
  title          TEXT    NOT NULL,
  description    TEXT,
  -- Sorumlu: belirli kullanıcı ya da rol havuzu
  assignee_id    INTEGER REFERENCES users(id),
  assignee_role  TEXT,
  factory_id     INTEGER REFERENCES factories(id),
  department_id  INTEGER REFERENCES departments(id),
  due_at         TEXT,
  -- BEKLEMEDE | DEVAM_EDIYOR | TAMAMLANDI | GEREKSIZ
  status         TEXT    NOT NULL DEFAULT 'BEKLEMEDE',
  sort_order     INTEGER NOT NULL DEFAULT 0,
  completed_at   TEXT,
  completed_by   INTEGER REFERENCES users(id),
  result_note    TEXT,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(complaint_id, code)
);
CREATE INDEX IF NOT EXISTS idx_tasks_complaint ON tasks(complaint_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee  ON tasks(assignee_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_role      ON tasks(factory_id, assignee_role, status);
CREATE INDEX IF NOT EXISTS idx_tasks_due       ON tasks(due_at, status);

-- --- Numune ve laboratuvar -------------------------------------------------

CREATE TABLE IF NOT EXISTS samples (
  id            INTEGER PRIMARY KEY,
  complaint_id  INTEGER NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  sample_no     TEXT    NOT NULL,
  taken_at      TEXT    NOT NULL,
  taken_by      INTEGER REFERENCES users(id),
  taken_place   TEXT,                             -- "Müşteri deposu" / "Fabrika ambarı"
  lot_no        TEXT,
  quantity      TEXT,                             -- "2 x 500 g"
  seal_no       TEXT,
  note          TEXT,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_samples_complaint ON samples(complaint_id);

CREATE TABLE IF NOT EXISTS analyses (
  id             INTEGER PRIMARY KEY,
  complaint_id   INTEGER NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  sample_id      INTEGER REFERENCES samples(id) ON DELETE SET NULL,
  report_no      TEXT    NOT NULL,
  analyzed_at    TEXT    NOT NULL,
  analyzed_by    INTEGER REFERENCES users(id),
  lab_name       TEXT,                            -- "Kalite ve İşletme Kontrol Laboratuvarı"
  -- UYGUN | UYGUN_DEGIL | KISMEN
  conformity     TEXT    NOT NULL,
  summary        TEXT,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_analyses_complaint ON analyses(complaint_id);

CREATE TABLE IF NOT EXISTS analysis_results (
  id            INTEGER PRIMARY KEY,
  analysis_id   INTEGER NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  parameter_id  INTEGER REFERENCES lab_parameters(id),
  parameter     TEXT    NOT NULL,
  value         TEXT    NOT NULL,
  unit          TEXT,
  spec_text     TEXT,
  conforms      INTEGER,                          -- 1 uygun, 0 uygun değil, NULL belirsiz
  sort_order    INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_results_analysis ON analysis_results(analysis_id);

-- --- Belgeler ve imza zinciri ---------------------------------------------

CREATE TABLE IF NOT EXISTS documents (
  id            INTEGER PRIMARY KEY,
  complaint_id  INTEGER NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  -- FR_PASAT_007 | FR_PASAT_004 | FR_PASAT_005 | MUSTERI_BILGILENDIRME
  type          TEXT    NOT NULL,
  doc_no        TEXT    NOT NULL,
  -- TASLAK | IMZADA | ONAYLANDI | REDDEDILDI | IPTAL
  status        TEXT    NOT NULL DEFAULT 'TASLAK',
  body          TEXT,                             -- JSON: forma basılan alanlar
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  created_by    INTEGER REFERENCES users(id),
  submitted_at  TEXT,
  approved_at   TEXT,
  approved_by   INTEGER REFERENCES users(id),
  cancelled_at  TEXT,
  cancel_reason TEXT
);
CREATE INDEX IF NOT EXISTS idx_documents_complaint ON documents(complaint_id);

CREATE TABLE IF NOT EXISTS document_signatures (
  id             INTEGER PRIMARY KEY,
  document_id    INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  sort_order     INTEGER NOT NULL,
  expected_role  TEXT    NOT NULL,
  expected_title TEXT    NOT NULL,                -- "Ambar Şefi"
  is_approval    INTEGER NOT NULL DEFAULT 0,      -- Fabrika Müdürü "Onay" satırı
  user_id        INTEGER REFERENCES users(id),
  signer_name    TEXT,
  signer_title   TEXT,
  -- BEKLIYOR | ONAY | RED
  decision       TEXT    NOT NULL DEFAULT 'BEKLIYOR',
  decided_at     TEXT,
  note           TEXT,
  UNIQUE(document_id, sort_order)
);
CREATE INDEX IF NOT EXISTS idx_signatures_document ON document_signatures(document_id, sort_order);

-- --- Dosya ekleri ----------------------------------------------------------

CREATE TABLE IF NOT EXISTS attachments (
  id            INTEGER PRIMARY KEY,
  complaint_id  INTEGER NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  document_id   INTEGER REFERENCES documents(id) ON DELETE SET NULL,
  analysis_id   INTEGER REFERENCES analyses(id) ON DELETE SET NULL,
  -- KANIT | ANALIZ_RAPORU | IMZALI_TUTANAK | RESMI_YAZI | FATURA | DIGER
  kind          TEXT    NOT NULL DEFAULT 'KANIT',
  file_name     TEXT    NOT NULL,
  stored_name   TEXT    NOT NULL,
  mime          TEXT    NOT NULL,
  size          INTEGER NOT NULL,
  caption       TEXT,
  uploaded_by   INTEGER REFERENCES users(id),
  uploader_label TEXT,                            -- "Müşteri"
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_attachments_complaint ON attachments(complaint_id);

-- --- Bildirimler (SMS / e-posta) ------------------------------------------

CREATE TABLE IF NOT EXISTS notifications (
  id            INTEGER PRIMARY KEY,
  complaint_id  INTEGER REFERENCES complaints(id) ON DELETE CASCADE,
  channel       TEXT    NOT NULL,                 -- SMS | EPOSTA
  template_code TEXT    NOT NULL,
  recipient     TEXT    NOT NULL,
  subject       TEXT,
  body          TEXT    NOT NULL,
  -- KUYRUKTA | GONDERILDI | HATA
  status        TEXT    NOT NULL DEFAULT 'KUYRUKTA',
  provider      TEXT,
  provider_ref  TEXT,
  segments      INTEGER NOT NULL DEFAULT 1,       -- SMS kredi adedi
  error         TEXT,
  attempts      INTEGER NOT NULL DEFAULT 0,
  sent_at       TEXT,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notifications_complaint ON notifications(complaint_id, id);
CREATE INDEX IF NOT EXISTS idx_notifications_status    ON notifications(status, created_at);

-- Halka açık formda telefon doğrulama
CREATE TABLE IF NOT EXISTS otp_codes (
  id          INTEGER PRIMARY KEY,
  phone       TEXT    NOT NULL,
  code_hash   TEXT    NOT NULL,
  purpose     TEXT    NOT NULL DEFAULT 'SIKAYET',
  expires_at  TEXT    NOT NULL,
  consumed_at TEXT,
  attempts    INTEGER NOT NULL DEFAULT 0,
  ip          TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_codes(phone, created_at);

-- Halka açık form için hız sınırı
CREATE TABLE IF NOT EXISTS rate_limits (
  id         INTEGER PRIMARY KEY,
  bucket     TEXT NOT NULL,
  ip         TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_rate_bucket ON rate_limits(bucket, ip, created_at);

-- --- Resmî yazı dağıtımı (md. 6) ------------------------------------------

CREATE TABLE IF NOT EXISTS official_letters (
  id            INTEGER PRIMARY KEY,
  complaint_id  INTEGER NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  letter_no     TEXT    NOT NULL,
  sent_at       TEXT    NOT NULL,
  sent_by       INTEGER REFERENCES users(id),
  recipients    TEXT    NOT NULL,                 -- JSON: daire id listesi
  note          TEXT,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_letters_complaint ON official_letters(complaint_id);

-- --- Aylık raporlar (md. 8) ----------------------------------------------

CREATE TABLE IF NOT EXISTS monthly_reports (
  id            INTEGER PRIMARY KEY,
  factory_id    INTEGER NOT NULL REFERENCES factories(id),
  year          INTEGER NOT NULL,
  month         INTEGER NOT NULL,
  generated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  generated_by  INTEGER REFERENCES users(id),
  prepared_by   TEXT,
  approved_by   TEXT,
  sent_at       TEXT,
  note          TEXT,
  UNIQUE(factory_id, year, month)
);
