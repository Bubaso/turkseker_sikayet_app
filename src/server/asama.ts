"use server";

/* ===========================================================================
   Aşama kaydı — sadeleştirilmiş süreç motoru.

   Eski modelde uygulama tutanak üretiyor, altı adımlı imza zinciri yürütüyor,
   numune ve analiz kaydı tutuyordu. Yeni modelde bunların tamamı fabrikada
   elle yapılır; uygulama yalnızca "hangi aşama, ne zaman, kim tarafından,
   hangi belgeyle kapandı" sorusunu yanıtlar.

   Tek bir giriş noktası vardır: asamayiKaydet(). Ekip kurma ve kapanış belge
   istemez; diğer bütün aşamalar bir belge yüklenerek kapanır.
   =========================================================================== */

import { all, one, run, scalar, tx } from "@/lib/db";
import { addBusinessDays, today } from "@/lib/dates";
import {
  ATTACHMENT_KIND, DEPT, SLA, STATUS, VERDICT, type Verdict,
} from "@/lib/domain";
import { ASAMA, ASAMALAR, EVRAK_ASAMALARI, bekleyenOnculler, durumHaritasi, kararSonrasiAsamalar,
         sureAlani, type AsamaKodu } from "@/lib/asamalar";
import { checkEscalation, escalationDepartment, letterRecipients } from "@/lib/esik";
import type { Complaint } from "@/lib/types";
import { canAccessFactory, requireUser, type SessionUser } from "./auth";
import { recordAttachment, type StoredFile } from "./attachments";
import { EVENT_TYPE, logEvent } from "./events";
import { TEMPLATE, notifyCustomer } from "./notify";
import { holidaySet } from "./settings";
import { asamalariAc, asamayiKapat, asamayiAtla, sonTarihleriEsitle } from "./asamalar-db";

function dosya(id: number): Complaint {
  const c = one<Complaint>("SELECT * FROM complaints WHERE id = ?", id);
  if (!c) throw new Error("Dosya bulunamadı.");
  return c;
}

function durumYaz(c: Complaint, yeni: string, user: SessionUser, not: string): void {
  if (c.status === yeni) return;
  run("UPDATE complaints SET status = ?, updated_at = datetime('now') WHERE id = ?", yeni, c.id);
  logEvent({
    complaintId: c.id, type: EVENT_TYPE.DURUM, title: not,
    fromStatus: c.status, toStatus: yeni, actorId: user.id,
  });
}

/* --- Yetki: aşamayı kim kaydedebilir ------------------------------------- */

export interface AsamaYetkisi {
  user: SessionUser;
  satir: { id: number; code: string; title: string; status: string; assignee_id: number | null };
  c: Complaint;
}

/**
 * Bir aşamayı, üzerindeki sorumlu ya da Fabrika Müdürü kaydedebilir. İş
 * fabrikada elle yapıldığı için kaydı sorumlunun yerine müdürün girmesi de
 * meşrudur; her kayıt kimin girdiğini saklar.
 */
export async function asamaYetkisi(complaintId: number, kod: AsamaKodu): Promise<AsamaYetkisi> {
  const user = await requireUser();
  const c = dosya(complaintId);
  if (!canAccessFactory(user, c.factory_id)) {
    throw new Error("Bu dosya başka bir fabrikaya ait; işlem yapma yetkiniz yok.");
  }

  const satirlar = all<{ id: number; code: string; title: string; status: string; assignee_id: number | null }>(
    "SELECT id, code, title, status, assignee_id FROM tasks WHERE complaint_id = ?", complaintId,
  );
  const satir = satirlar.find((t) => t.code === kod);
  if (!satir) throw new Error(`Bu dosyada "${ASAMALAR[kod].baslik}" aşaması açılmamış.`);
  if (satir.status === "TAMAMLANDI" || satir.status === "GEREKSIZ") {
    throw new Error(`"${satir.title}" aşaması daha önce kapatılmış.`);
  }

  const bekleyen = bekleyenOnculler(kod, durumHaritasi(satirlar));
  if (bekleyen.length > 0) {
    throw new Error(
      `Bu aşamanın sırası gelmedi. Önce tamamlanmalı: ` +
      bekleyen.map((b) => ASAMALAR[b].baslik).join("; ") + ".",
    );
  }

  const mudurMu = user.role === "FABRIKA_MUDURU" || user.role === "SISTEM_YONETICISI";
  const daireMi = user.role === "GM_DAIRE" && kod === ASAMA.DAIRE_KARAR;
  if (!mudurMu && !daireMi && satir.assignee_id !== null && satir.assignee_id !== user.id) {
    const o = one<{ full_name: string; title: string }>(
      "SELECT full_name, title FROM users WHERE id = ?", satir.assignee_id,
    );
    throw new Error(
      `"${satir.title}" aşaması ${o?.full_name ?? "başka bir personel"} üzerinde. ` +
      "Bu aşamayı sorumlusu ya da Fabrika Müdürü kaydedebilir.",
    );
  }
  return { user, satir, c };
}

/* --- 1. Ekip kurma (md. 2-3) --------------------------------------------- */

export interface EkipUyesi {
  userId: number;
  unvan: string;
}



export async function ekibiKur(
  complaintId: number, uyeler: EkipUyesi[], not: string | null,
  evrakSorumlusuId?: number,
): Promise<void> {
  const { user, c } = await asamaYetkisi(complaintId, ASAMA.EKIP);
  const temiz = uyeler.filter((u) => Number.isFinite(u.userId) && u.userId > 0);
  if (temiz.length === 0) throw new Error("Ekibe en az bir personel eklenmelidir.");

  /*
   * Evrak sorumlusu: fabrika tarafındaki bütün belgeli aşamalar bu kişiye
   * düşer, dosya tek elden yürür ve yalnızca onun ekranında görünür. Ekip
   * dışından biri seçilemez; seçilmemişse ilk üye sorumlu olur.
   */
  const sorumlu = temiz.some((u) => u.userId === evrakSorumlusuId)
    ? evrakSorumlusuId!
    : temiz[0].userId;

  tx(() => {
    run("DELETE FROM team_members WHERE complaint_id = ?", complaintId);
    temiz.forEach((u) => {
      run(
        `INSERT INTO team_members (complaint_id, user_id, unit, is_lead, assigned_by)
         VALUES (?, ?, ?, ?, ?)`,
        complaintId, u.userId, u.unvan, u.userId === sorumlu ? 1 : 0, user.id,
      );
    });
    run("UPDATE complaints SET team_formed_at = datetime('now') WHERE id = ?", complaintId);

    /*
     * Sorumluluk saklanır: karar sonrası açılacak aşamalar (iade/değişim,
     * resmî yazı) ekip kurulurken henüz açılmamıştır, açıldıklarında buradan
     * okunur.
     */
    run("DELETE FROM stage_assignments WHERE complaint_id = ?", complaintId);
    for (const kod of EVRAK_ASAMALARI) {
      run(
        `INSERT INTO stage_assignments (complaint_id, code, user_id, assigned_by)
         VALUES (?, ?, ?, ?)`,
        complaintId, kod, sorumlu, user.id,
      );
      // Hâlihazırda açık olan aşamalara hemen uygulanır.
      run(
        `UPDATE tasks SET assignee_id = ? WHERE complaint_id = ? AND code = ?
           AND status IN ('BEKLEMEDE','DEVAM_EDIYOR')`,
        sorumlu, complaintId, kod,
      );
    }

    asamayiKapat(complaintId, ASAMA.EKIP, user.id, not);
    const adlar = all<{ full_name: string; unit: string }>(
      `SELECT u.full_name, tm.unit FROM team_members tm JOIN users u ON u.id = tm.user_id
        WHERE tm.complaint_id = ? ORDER BY tm.id`, complaintId,
    ).map((r) => `${r.full_name} (${r.unit})`);

    const sorumluAdi = one<{ full_name: string; title: string }>(
      "SELECT full_name, title FROM users WHERE id = ?", sorumlu,
    );

    logEvent({
      complaintId, type: EVENT_TYPE.EKIP,
      title: `İnceleme ekibi oluşturuldu (${temiz.length} kişi)`,
      note: `${adlar.join(", ")}\nEvrak sorumlusu: ` +
            `${sorumluAdi?.full_name ?? "—"}${sorumluAdi ? ` (${sorumluAdi.title})` : ""}`,
      actorId: user.id,
    });
    durumYaz(dosya(complaintId), STATUS.INCELEMEDE, user, "Ekip oluşturuldu");
  });

  await notifyCustomer({
    complaintId, code: TEMPLATE.EKIP,
    phone: c.customer_phone, email: c.customer_email,
    ctx: {
      complaintNo: c.complaint_no, trackingToken: c.tracking_token,
      dueDate: c.due_inspection_at, customerCompany: c.customer_company,
    },
  });
}

/* --- 2. Daha yakın fabrikaya yönlendirme (md. 2) ------------------------- */

export async function dosyayiYonlendir(
  complaintId: number, hedefFabrikaId: number, gerekce: string,
): Promise<void> {
  const { user, c } = await asamaYetkisi(complaintId, ASAMA.EKIP);
  if (!gerekce.trim()) throw new Error("Yönlendirme gerekçesi zorunludur.");
  if (hedefFabrikaId === c.factory_id) throw new Error("Dosya zaten bu fabrikada.");
  const hedef = one<{ id: number; name: string }>(
    "SELECT id, name FROM factories WHERE id = ? AND is_active = 1", hedefFabrikaId,
  );
  if (!hedef) throw new Error("Geçersiz fabrika seçimi.");

  const holidays = holidaySet();
  tx(() => {
    run(
      `UPDATE complaints
          SET factory_id = ?, redirected_at = datetime('now'), redirected_from_id = ?,
              redirect_reason = ?, status = ?, due_team_at = ?, updated_at = datetime('now')
        WHERE id = ?`,
      hedef.id, c.factory_id, gerekce, STATUS.YONLENDIRILDI,
      addBusinessDays(today(), SLA.EKIP, holidays), complaintId,
    );
    // Açık aşamalar yeni fabrikanın aynı unvandaki personeline devredilir.
    for (const t of all<{ id: number; assignee_role: string | null }>(
      "SELECT id, assignee_role FROM tasks WHERE complaint_id = ? AND status IN ('BEKLEMEDE','DEVAM_EDIYOR')",
      complaintId,
    )) {
      if (!t.assignee_role || t.assignee_role.startsWith("GM_")) continue;
      const yeni = one<{ id: number }>(
        "SELECT id FROM users WHERE factory_id = ? AND role = ? AND is_active = 1 ORDER BY id LIMIT 1",
        hedef.id, t.assignee_role,
      );
      run("UPDATE tasks SET factory_id = ?, assignee_id = ? WHERE id = ?",
          hedef.id, yeni?.id ?? null, t.id);
    }
    run("DELETE FROM team_members WHERE complaint_id = ?", complaintId);
    logEvent({
      complaintId, type: EVENT_TYPE.YONLENDIRME,
      title: `Dosya ${hedef.name} fabrikasına yönlendirildi`,
      note: gerekce, fromStatus: c.status, toStatus: STATUS.YONLENDIRILDI, actorId: user.id,
    });
  });

  await notifyCustomer({
    complaintId, code: TEMPLATE.YONLENDIRME,
    phone: c.customer_phone, email: c.customer_email,
    ctx: {
      complaintNo: c.complaint_no, trackingToken: c.tracking_token,
      factoryName: hedef.name, customerCompany: c.customer_company,
    },
  });
}

/* --- 3. Belgeli aşamaların kaydı ----------------------------------------- */

export interface AsamaKaydi {
  /** Aşamanın gerçekleştiği tarih. */
  tarih: string;
  not: string;
  /**
   * Diske yazılmış belgeler; belgeli aşamalarda en az bir dosya zorunludur.
   * Ek kayıtları aşama kaydıyla aynı işlemde açılır: kayıt başarısız olursa
   * yarım kalmış ek satırı geride kalmaz.
   */
  belgeler?: StoredFile[];
  /** KARAR aşamasında: şikâyet haklı mı? */
  karar?: Verdict;
  /** DAIRE_KARAR aşamasında: itiraz kabul edildi mi? */
  itirazKabul?: boolean;
  /**
   * ISLEM aşamasında isteğe bağlı gerçekleşme tutarları. Kilometre taşını
   * kapatan şey belgedir; bu alanlar yalnızca aylık rapor ve maliyet takibi
   * için girilir (TL PASAT 004 md. 9 aylık tablo sütunları).
   */
  iadeKg?: number | null;
  degisimKg?: number | null;
  bedel?: number | null;
  nakliye?: number | null;
}

/**
 * Bir kilometre taşını kayda geçirir. Belge istenen aşamalarda ek zorunludur;
 * belge uygulamada üretilmez, dışarıda hazırlanıp yüklenir.
 */
export async function asamayiKaydet(
  complaintId: number, kod: AsamaKodu, kayit: AsamaKaydi,
): Promise<void> {
  const { user, c } = await asamaYetkisi(complaintId, kod);
  const a = ASAMALAR[kod];
  if (!kayit.tarih) throw new Error("Tarih zorunludur.");
  if (!kayit.not.trim()) throw new Error("Kısa bir açıklama zorunludur.");
  const belgeler = kayit.belgeler ?? [];
  if (a.belgeli && belgeler.length === 0) {
    throw new Error(`Bu aşama belge yüklenerek kapanır: ${a.belgeAdi ?? "ilgili belge"}.`);
  }

  const holidays = holidaySet();

  tx(() => {
    for (const f of belgeler) {
      recordAttachment(f, {
        complaintId, kind: kod, caption: a.belgeAdi ?? a.baslik, uploadedBy: user.id,
      });
    }

    if (kod === ASAMA.KARAR) {
      if (!kayit.karar) throw new Error("Karar (haklı / haklı değil) seçilmelidir.");
      const esik = checkEscalation(c.product_group, c.quantity_kg);
      const hakli = kayit.karar === VERDICT.HAKLI;
      const itirazGerekir = !hakli && esik.required;

      run(
        `UPDATE complaints SET verdict = ?, verdict_reason = ?, verdict_at = datetime('now'),
                decision = ?, updated_at = datetime('now') WHERE id = ?`,
        kayit.karar, kayit.not, kayit.not, complaintId,
      );
      if (itirazGerekir) {
        const d = one<{ id: number }>("SELECT id FROM departments WHERE code = ?",
                                      escalationDepartment(c.product_group));
        run("UPDATE complaints SET escalated_dept_id = ?, escalation_reason = ? WHERE id = ?",
            d?.id ?? null, esik.reason, complaintId);
      }
      asamayiKapat(complaintId, kod, user.id, kayit.not, kayit.tarih);
      asamalariAc(dosya(complaintId), kararSonrasiAsamalar({ hakli, itirazGerekir }));
    } else if (kod === ASAMA.ITIRAZ) {
      const due = addBusinessDays(kayit.tarih, SLA.ITIRAZ, holidays);
      run(
        `UPDATE complaints SET escalated_at = datetime('now'), escalation_due_at = ?,
                updated_at = datetime('now') WHERE id = ?`,
        due, complaintId,
      );
      asamayiKapat(complaintId, kod, user.id, kayit.not, kayit.tarih);
      run("UPDATE tasks SET due_at = ? WHERE complaint_id = ? AND code = ?",
          due, complaintId, ASAMA.DAIRE_KARAR);
    } else if (kod === ASAMA.DAIRE_KARAR) {
      const kabul = kayit.itirazKabul === true;
      run(
        `UPDATE complaints SET escalation_result = ?, escalation_note = ?,
                escalation_decided_at = datetime('now'), escalation_decided_by = ?,
                updated_at = datetime('now') WHERE id = ?`,
        kabul ? "SIKAYET_HAKLI" : "SIKAYET_HAKSIZ", kayit.not, user.id, complaintId,
      );
      asamayiKapat(complaintId, kod, user.id, kayit.not, kayit.tarih);
      if (kabul) {
        // İtiraz kabul edildi: karar haklıya döner ve işlem aşaması açılır.
        // İşlem süresi daire kararı tarihinden yeniden başlar.
        const yeniSure = addBusinessDays(kayit.tarih, SLA.ISLEM, holidays);
        run(
          `UPDATE complaints SET verdict = 'HAKLI', due_resolution_at = ?,
                  updated_at = datetime('now') WHERE id = ?`,
          yeniSure, complaintId,
        );
        asamalariAc(dosya(complaintId), [ASAMA.ISLEM]);
        logEvent({
          complaintId, type: EVENT_TYPE.ITIRAZ,
          title: "İşlem süresi daire kararı tarihinden yeniden başlatıldı",
          note: `İade/değişim için süre ${yeniSure} tarihine kadar uzatıldı.`,
          actorId: user.id,
        });
      }
    } else if (kod === ASAMA.ISLEM) {
      const rapor = addBusinessDays(kayit.tarih, SLA.RESMI_YAZI, holidays);
      run(
        // Tutar alanları isteğe bağlıdır: boş bırakılan alan mevcut değeri korur
        // (sütunlar NOT NULL DEFAULT 0 tanımlıdır).
        `UPDATE complaints SET transaction_date = ?, due_report_at = ?,
                returned_kg = COALESCE(?, returned_kg),
                exchanged_kg = COALESCE(?, exchanged_kg),
                refund_amount = COALESCE(?, refund_amount),
                freight_amount = COALESCE(?, freight_amount),
                freight_paid_at = COALESCE(?, freight_paid_at),
                updated_at = datetime('now') WHERE id = ?`,
        kayit.tarih, rapor,
        kayit.iadeKg ?? null, kayit.degisimKg ?? null, kayit.bedel ?? null,
        kayit.nakliye ?? null, kayit.nakliye ? kayit.tarih : null,
        complaintId,
      );
      asamayiKapat(complaintId, kod, user.id, kayit.not, kayit.tarih);
      sonTarihleriEsitle(dosya(complaintId));
    } else if (kod === ASAMA.RESMI_YAZI) {
      // Resmî yazı, Daire Başkanlıklarının gelen kutusunda görünsün diye
      // kayıt altına da alınır (md. 6 ve 8).
      const codes = letterRecipients(c.product_group);
      const depts = all<{ id: number }>(
        `SELECT id FROM departments WHERE code IN (${codes.map(() => "?").join(",")})`, ...codes,
      );
      const no = `${kayit.tarih.slice(0, 4)}/${c.complaint_no}`;
      run(
        `INSERT INTO official_letters (complaint_id, letter_no, sent_at, sent_by, recipients, note)
         VALUES (?, ?, ?, ?, ?, ?)`,
        complaintId, no, kayit.tarih, user.id, JSON.stringify(depts.map((d) => d.id)), kayit.not,
      );
      run(
        `UPDATE complaints SET letter_sent_at = ?, letter_no = ?,
                customer_informed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
        kayit.tarih, no, complaintId,
      );
      asamayiKapat(complaintId, kod, user.id, kayit.not, kayit.tarih);
    } else if (kod === ASAMA.INCELEME) {
      // İnceleme tarihi ve notu dosyanın künyesine de yazılır; müşteri takip
      // sayfası ve aylık rapor bu alanları okur.
      run(
        `UPDATE complaints SET visited_at = ?, inspection_note = ?,
                updated_at = datetime('now') WHERE id = ?`,
        kayit.tarih, kayit.not, complaintId,
      );
      asamayiKapat(complaintId, kod, user.id, kayit.not, kayit.tarih);
    } else {
      asamayiKapat(complaintId, kod, user.id, kayit.not, kayit.tarih);
    }

    const guncel = dosya(complaintId);
    if (a.durum) durumYaz(guncel, a.durum, user, `${a.baslik} tamamlandı`);
    logEvent({
      complaintId, type: EVENT_TYPE.BELGE,
      title: `${a.baslik} kayda geçirildi`,
      note: kayit.not, actorId: user.id,
      payload: { tarih: kayit.tarih, belge: belgeler.map((f) => f.fileName) },
    });
  });

  await asamaBildirimi(complaintId, kod, kayit);
}

/** Kilometre taşında müşteriye giden bildirim. */
async function asamaBildirimi(
  complaintId: number, kod: AsamaKodu, kayit: AsamaKaydi,
): Promise<void> {
  const c = dosya(complaintId);
  const ctx = {
    complaintNo: c.complaint_no, trackingToken: c.tracking_token,
    customerCompany: c.customer_company, date: kayit.tarih,
    dueDate: c.due_resolution_at,
  };
  const gonder = (code: string) =>
    notifyCustomer({ complaintId, code: code as never, phone: c.customer_phone,
                     email: c.customer_email, ctx });

  switch (kod) {
    case ASAMA.INCELEME: return void (await gonder(TEMPLATE.ZIYARET));
    case ASAMA.KARAR:
      return void (await gonder(
        c.verdict === VERDICT.HAKLI ? TEMPLATE.KARAR_HAKLI : TEMPLATE.KARAR_HAKSIZ));
    case ASAMA.ITIRAZ: return void (await gonder(TEMPLATE.ITIRAZ_BASLADI));
    case ASAMA.DAIRE_KARAR: return void (await gonder(TEMPLATE.ITIRAZ_SONUC));
    case ASAMA.ISLEM: return void (await gonder(TEMPLATE.ISLEM_TAMAM));
    default: return;
  }
}

/* --- 4. Kapanış ve iptal -------------------------------------------------- */

export async function dosyayiKapat(complaintId: number, not: string): Promise<void> {
  const { user } = await asamaYetkisi(complaintId, ASAMA.KAPANIS);
  if (!not.trim()) throw new Error("Kapanış notu zorunludur.");

  const acik = all<{ title: string }>(
    `SELECT title FROM tasks WHERE complaint_id = ? AND code <> ?
       AND status IN ('BEKLEMEDE','DEVAM_EDIYOR')`,
    complaintId, ASAMA.KAPANIS,
  );
  if (acik.length > 0) {
    throw new Error(
      `Kapatmadan önce tamamlanmayan ${acik.length} aşama var: ` +
      acik.map((t) => t.title).join(", "),
    );
  }

  const c = dosya(complaintId);
  const sonDurum = c.verdict === VERDICT.HAKSIZ ? STATUS.REDDEDILDI : STATUS.KAPANDI;
  tx(() => {
    run(
      `UPDATE complaints SET closed_at = datetime('now'), closing_note = ?, status = ?,
              updated_at = datetime('now') WHERE id = ?`,
      not, sonDurum, complaintId,
    );
    asamayiKapat(complaintId, ASAMA.KAPANIS, user.id, not);
    logEvent({
      complaintId, type: EVENT_TYPE.KAPANIS,
      title: sonDurum === STATUS.KAPANDI ? "Dosya kapatıldı" : "Dosya kapatıldı (haklı bulunmadı)",
      note: not, fromStatus: c.status, toStatus: sonDurum, actorId: user.id,
    });
  });

  await notifyCustomer({
    complaintId, code: TEMPLATE.KAPANIS, phone: c.customer_phone, email: c.customer_email,
    ctx: { complaintNo: c.complaint_no, trackingToken: c.tracking_token,
           customerCompany: c.customer_company, extra: not },
  });
}

export async function dosyayiIptalEt(complaintId: number, gerekce: string): Promise<void> {
  const user = await requireUser();
  const c = dosya(complaintId);
  if (!canAccessFactory(user, c.factory_id)) throw new Error("Bu dosyaya erişiminiz yok.");
  if (user.role !== "FABRIKA_MUDURU" && user.role !== "SISTEM_YONETICISI") {
    throw new Error("Dosyayı yalnızca Fabrika Müdürü iptal edebilir.");
  }
  if (!gerekce.trim()) throw new Error("İptal gerekçesi zorunludur.");

  tx(() => {
    run(
      `UPDATE complaints SET status = ?, closed_at = datetime('now'), closing_note = ?,
              updated_at = datetime('now') WHERE id = ?`,
      STATUS.IPTAL, gerekce, complaintId,
    );
    run(
      `UPDATE tasks SET status = 'GEREKSIZ', completed_at = datetime('now'), result_note = ?
        WHERE complaint_id = ? AND status IN ('BEKLEMEDE','DEVAM_EDIYOR')`,
      "Dosya iptal edildi", complaintId,
    );
    logEvent({
      complaintId, type: EVENT_TYPE.KAPANIS, title: "Dosya iptal edildi",
      note: gerekce, fromStatus: c.status, toStatus: STATUS.IPTAL, actorId: user.id,
    });
  });
}

/** Koşulu oluşmayan aşamayı atlar — yalnızca Fabrika Müdürü. */
export async function asamayiGerekmez(
  complaintId: number, kod: AsamaKodu, gerekce: string,
): Promise<void> {
  const user = await requireUser();
  const c = dosya(complaintId);
  if (!canAccessFactory(user, c.factory_id)) throw new Error("Bu dosyaya erişiminiz yok.");
  if (user.role !== "FABRIKA_MUDURU" && user.role !== "SISTEM_YONETICISI") {
    throw new Error("Bir aşamayı yalnızca Fabrika Müdürü atlayabilir.");
  }
  asamayiAtla(complaintId, kod, gerekce || "Fabrika Müdürü tarafından gerekli görülmedi");
  logEvent({
    complaintId, type: EVENT_TYPE.GOREV,
    title: `${ASAMALAR[kod].baslik} — gerekmediği için atlandı`,
    note: gerekce, actorId: user.id,
  });
}

