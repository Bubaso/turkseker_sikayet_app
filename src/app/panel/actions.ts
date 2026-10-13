"use server";

/* ===========================================================================
   Panel sunucu eylemleri. Tümü aynı sonuç biçimini döndürür; istemci tarafı
   <ActionForm> bileşeni bu biçimi okuyarak hata/başarı mesajını gösterir.
   =========================================================================== */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { all, one } from "@/lib/db";
import { CHANNEL, DEMAND, VERDICT, type Verdict } from "@/lib/domain";
import { PERMISSIONS, can } from "@/lib/roles";
import { requireFactoryAccess, requirePermission, requireUser } from "@/server/auth";
import {
  cancelComplaint, closeComplaint, decideEscalation, escalateComplaint, formTeam,
  onTutanakApproved, prepareTutanak, recordInspection, recordTransaction, redirectComplaint,
  sendCustomerInfo, sendOfficialLetter, startCapa,
} from "@/server/process";
import { addAnalysis, addSample, evaluateParameter, labParameters } from "@/server/lab";
import { getDocument, reopenDocument, signDocument } from "@/server/documents";
import { createComplaint } from "@/server/complaints";
import { deleteAttachment, recordAttachment, storeFile } from "@/server/attachments";
import { setTaskStatus } from "@/server/tasks";
import { EVENT_TYPE, logEvent } from "@/server/events";
import { deliver, retryFailed } from "@/server/notify";
import { setSetting } from "@/server/settings";
import type { LabParameter } from "@/lib/types";

export interface ActionResult {
  ok?: boolean;
  error?: string;
  message?: string;
}

function s(fd: FormData, k: string): string {
  return String(fd.get(k) ?? "").trim();
}
function n(fd: FormData, k: string): number | null {
  const raw = s(fd, k).replace(/\./g, "").replace(",", ".");
  if (!raw) return null;
  const v = Number(raw);
  return Number.isFinite(v) ? v : null;
}
function id(fd: FormData, k = "complaintId"): number {
  const v = Number(s(fd, k));
  if (!v) throw new Error("Kayıt kimliği eksik.");
  return v;
}

/**
 * Eylemi çalıştırır, hatayı kullanıcıya gösterilecek metne çevirir.
 * Başarılı olduğunda formun bulunduğu sayfaya sonuç mesajıyla birlikte geri
 * döner; çünkü adım tamamlandığında form çoğu zaman ekrandan kalkar ve sonuç
 * mesajı form içinde gösterilemez.
 */
async function guard(
  fn: () => Promise<string>, paths: string[], returnTo?: string | null,
): Promise<ActionResult> {
  let message: string;
  try {
    message = await fn();
    for (const p of paths) revalidatePath(p);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  if (returnTo && returnTo.startsWith("/")) {
    const sep = returnTo.includes("?") ? "&" : "?";
    redirect(`${returnTo}${sep}m=${encodeURIComponent(message.slice(0, 300))}`);
  }
  return { ok: true, message };
}

const detail = (cid: number) => [`/panel/sikayet/${cid}`, "/panel", "/panel/sikayetler", "/panel/gorevler"];

/* --- 1. Ekip ------------------------------------------------------------- */

export async function formTeamAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const cid = id(fd);
  return guard(async () => {
    const picks = fd.getAll("member").map(String).filter(Boolean);
    if (picks.length === 0) throw new Error("Ekibe en az bir personel seçmelisiniz.");
    const leadId = Number(s(fd, "lead"));
    const members = picks.map((p) => {
      const [userId, unit] = p.split("|");
      return { userId: Number(userId), unit: unit!, isLead: Number(userId) === leadId };
    });
    await formTeam(cid, members, s(fd, "note") || null);
    return `İnceleme ekibi oluşturuldu (${members.length} kişi). Müşteriye bilgilendirme gönderildi.`;
  }, detail(cid), s(fd, "returnTo"));
}

/* --- 2. Yönlendirme ------------------------------------------------------ */

export async function redirectAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const cid = id(fd);
  return guard(async () => {
    const to = Number(s(fd, "toFactoryId"));
    const reason = s(fd, "reason");
    if (!to) throw new Error("Hedef fabrika seçilmedi.");
    if (!reason) throw new Error("Yönlendirme gerekçesi zorunludur.");
    await redirectComplaint(cid, to, reason);
    return "Dosya yönlendirildi; yeni fabrikanın ekip kurma süresi yeniden hesaplandı.";
  }, detail(cid), s(fd, "returnTo"));
}

/* --- 3. İnceleme --------------------------------------------------------- */

export async function inspectionAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const cid = id(fd);
  return guard(async () => {
    const labRequired = s(fd, "labRequired") === "1";
    await recordInspection(cid, {
      visitedAt: s(fd, "visitedAt"),
      note: s(fd, "note"),
      remoteOnly: s(fd, "remoteOnly") === "1",
      labRequired,
      labSkipReason: labRequired ? null : s(fd, "labSkipReason"),
    });
    return labRequired
      ? "İnceleme kaydedildi. Numune ve analiz görevleri açıldı."
      : "İnceleme kaydedildi. Analiz yapılmama gerekçesi tutanağa işlenecek.";
  }, detail(cid), s(fd, "returnTo"));
}

/* --- 4. Numune ve analiz ------------------------------------------------- */

export async function sampleAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const cid = id(fd);
  return guard(async () => {
    await addSample(cid, {
      takenAt: s(fd, "takenAt"),
      takenPlace: s(fd, "takenPlace"),
      lotNo: s(fd, "lotNo") || null,
      quantity: s(fd, "quantity") || null,
      sealNo: s(fd, "sealNo") || null,
      note: s(fd, "note") || null,
    });
    return "Numune kaydedildi. Müşteriye bilgilendirme gönderildi.";
  }, detail(cid), s(fd, "returnTo"));
}

export async function analysisAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const cid = id(fd);
  return guard(async () => {
    const group = s(fd, "productGroup");
    const params = labParameters(group);
    const byId = new Map<number, LabParameter>(params.map((p) => [p.id, p]));

    const results = [];
    for (const key of fd.keys()) {
      if (!key.startsWith("deger_")) continue;
      const pid = Number(key.slice(6));
      const value = s(fd, key);
      if (!value) continue;
      const p = byId.get(pid);
      if (!p) continue;
      const manual = s(fd, `uygun_${pid}`);
      const conforms =
        manual === "1" ? true : manual === "0" ? false : evaluateParameter(p, value);
      results.push({
        parameterId: p.id,
        parameter: p.name,
        value,
        unit: p.unit,
        specText: p.spec_text,
        conforms,
      });
    }
    if (results.length === 0) throw new Error("En az bir parametreye değer girmelisiniz.");

    const analysisId = await addAnalysis(cid, {
      sampleId: Number(s(fd, "sampleId")) || null,
      reportNo: s(fd, "reportNo"),
      analyzedAt: s(fd, "analyzedAt"),
      labName: s(fd, "labName") || null,
      summary: s(fd, "summary") || null,
      results,
    });

    // Analiz raporu dosyası
    const user = await requireUser();
    const file = fd.get("rapor");
    if (file instanceof File && file.size > 0) {
      const stored = await storeFile(file);
      recordAttachment(stored, {
        complaintId: cid, kind: "ANALIZ_RAPORU", analysisId,
        caption: `Analiz raporu ${s(fd, "reportNo")}`, uploadedBy: user.id,
      });
    }
    const bad = results.filter((r) => r.conforms === false).length;
    return bad > 0
      ? `Analiz kaydedildi. ${bad} parametre spesifikasyon dışı — sonuç "uygun değil".`
      : "Analiz kaydedildi. Tüm parametreler spesifikasyona uygun.";
  }, detail(cid), s(fd, "returnTo"));
}

/* --- 5. Tutanak ve imza -------------------------------------------------- */

export async function tutanakAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const cid = id(fd);
  return guard(async () => {
    const verdict = s(fd, "verdict") as Verdict;
    if (verdict !== VERDICT.HAKLI && verdict !== VERDICT.HAKSIZ) {
      throw new Error("Karar seçilmedi.");
    }
    await prepareTutanak(cid, {
      verdict,
      verdictReason: s(fd, "verdictReason"),
      decision: s(fd, "decision"),
      bodyNote: s(fd, "bodyNote") || null,
    });
    return "Tutanak düzenlendi ve imza sürecine alındı. Sıradaki imza sahibine düştü.";
  }, detail(cid), s(fd, "returnTo"));
}

export async function signAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const cid = id(fd);
  return guard(async () => {
    const user = await requirePermission(PERMISSIONS.BELGE_IMZALA);
    const docId = Number(s(fd, "documentId"));
    const decision = s(fd, "decision") === "RED" ? "RED" : "ONAY";
    const doc = getDocument(docId);
    if (!doc) throw new Error("Belge bulunamadı.");

    const res = signDocument(docId, user, decision, s(fd, "note") || null);

    if (res.rejected) return "Belge reddedildi. Düzeltme için taslağa alınabilir.";
    if (res.completed) {
      const isTutanak = ["FR_PASAT_004", "FR_PASAT_005", "INCELEME_TUTANAGI"].includes(doc.type);
      if (isTutanak) {
        await onTutanakApproved(cid, user);
        return "Tutanak Fabrika Müdürü onayıyla tamamlandı. Karar kesinleşti ve sonraki görevler açıldı.";
      }
      return "Belge imza zinciri tamamlandı ve onaylandı.";
    }
    return "İmzanız kaydedildi. Belge sıradaki imza sahibine geçti.";
  }, detail(cid), s(fd, "returnTo"));
}

export async function reopenDocAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const cid = id(fd);
  return guard(async () => {
    const user = await requirePermission(PERMISSIONS.BELGE_HAZIRLA);
    const reason = s(fd, "reason");
    if (!reason) throw new Error("Düzeltme gerekçesi zorunludur.");
    reopenDocument(Number(s(fd, "documentId")), user, reason);
    return "Belge taslağa alındı, imzalar sıfırlandı.";
  }, detail(cid), s(fd, "returnTo"));
}

/* --- 6. İtiraz ----------------------------------------------------------- */

export async function escalateAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const cid = id(fd);
  return guard(async () => {
    await escalateComplaint(cid, s(fd, "note") || null);
    return "İtiraz ilgili Daire Başkanlığına gönderildi. Karar süresi 5 iş günü.";
  }, detail(cid), s(fd, "returnTo"));
}

export async function escalationDecisionAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const cid = id(fd);
  return guard(async () => {
    const result = s(fd, "result") === "SIKAYET_HAKLI" ? "SIKAYET_HAKLI" : "SIKAYET_HAKSIZ";
    await decideEscalation(cid, result, s(fd, "note"));
    return result === "SIKAYET_HAKLI"
      ? "İtiraz kabul edildi. Dosya iade/değişim sürecine döndü."
      : "İtiraz reddedildi. Fabrika kararı teyit edildi.";
  }, [...detail(cid), "/panel/itirazlar"], s(fd, "returnTo"));
}

/* --- 7. İşlem, DF, resmî yazı, bilgilendirme, kapanış ------------------- */

export async function transactionAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const cid = id(fd);
  return guard(async () => {
    await recordTransaction(cid, {
      transactionDate: s(fd, "transactionDate"),
      returnedKg: n(fd, "returnedKg") ?? 0,
      exchangedKg: n(fd, "exchangedKg") ?? 0,
      refundAmount: n(fd, "refundAmount") ?? 0,
      freightAmount: n(fd, "freightAmount") ?? 0,
      note: s(fd, "note") || null,
    });
    return "İşlem kaydedildi. Resmî yazı için 3 iş günlük süre başladı.";
  }, detail(cid), s(fd, "returnTo"));
}

export async function capaAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const cid = id(fd);
  return guard(async () => {
    const no = s(fd, "capaNo");
    const note = s(fd, "note");
    if (!no) throw new Error("Düzeltici faaliyet numarası zorunludur.");
    if (!note) throw new Error("Düzeltici faaliyet açıklaması zorunludur.");
    await startCapa(cid, no, note);
    return "FSSC 22000 düzeltici faaliyet kaydı açıldı.";
  }, detail(cid), s(fd, "returnTo"));
}

export async function letterAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const cid = id(fd);
  return guard(async () => {
    await sendOfficialLetter(cid, s(fd, "letterNo"), s(fd, "note") || null);
    return "Resmî yazı dağıtımı kaydedildi.";
  }, detail(cid), s(fd, "returnTo"));
}

export async function customerInfoAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const cid = id(fd);
  return guard(async () => {
    await sendCustomerInfo(cid, s(fd, "explanation"));
    return "Müşteri Bilgilendirme Formu düzenlendi ve müşteriye gönderildi.";
  }, detail(cid), s(fd, "returnTo"));
}

export async function closeAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const cid = id(fd);
  return guard(async () => {
    await closeComplaint(cid, s(fd, "note"));
    return "Dosya kapatıldı. Müşteriye kapanış bildirimi gönderildi.";
  }, detail(cid), s(fd, "returnTo"));
}

export async function cancelAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const cid = id(fd);
  return guard(async () => {
    await cancelComplaint(cid, s(fd, "reason"));
    return "Dosya iptal edildi.";
  }, detail(cid), s(fd, "returnTo"));
}

/* --- 8. Görev, not, dosya ----------------------------------------------- */

export async function taskStatusAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const cid = id(fd);
  return guard(async () => {
    const user = await requireUser();
    setTaskStatus(Number(s(fd, "taskId")), s(fd, "status"), user, s(fd, "note") || null);
    return "Görev güncellendi.";
  }, detail(cid), s(fd, "returnTo"));
}

export async function noteAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const cid = id(fd);
  return guard(async () => {
    const user = await requireUser();
    const c = one<{ factory_id: number }>("SELECT factory_id FROM complaints WHERE id = ?", cid);
    if (!c) throw new Error("Dosya bulunamadı.");
    await requireFactoryAccess(c.factory_id);
    const note = s(fd, "note");
    if (!note) throw new Error("Not metni boş olamaz.");
    logEvent({ complaintId: cid, type: EVENT_TYPE.NOT, title: "Dosya notu", note, actorId: user.id });
    return "Not eklendi.";
  }, detail(cid), s(fd, "returnTo"));
}

export async function uploadAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const cid = id(fd);
  return guard(async () => {
    const user = await requireUser();
    const c = one<{ factory_id: number }>("SELECT factory_id FROM complaints WHERE id = ?", cid);
    if (!c) throw new Error("Dosya bulunamadı.");
    await requireFactoryAccess(c.factory_id);

    const files = fd.getAll("dosya").filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length === 0) throw new Error("Dosya seçilmedi.");
    for (const f of files) {
      const stored = await storeFile(f);
      recordAttachment(stored, {
        complaintId: cid,
        kind: s(fd, "kind") || "DIGER",
        caption: s(fd, "caption") || null,
        uploadedBy: user.id,
      });
    }
    return `${files.length} dosya yüklendi.`;
  }, detail(cid), s(fd, "returnTo"));
}

export async function deleteAttachmentAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const cid = id(fd);
  return guard(async () => {
    const user = await requireUser();
    const c = one<{ factory_id: number }>("SELECT factory_id FROM complaints WHERE id = ?", cid);
    if (!c) throw new Error("Dosya bulunamadı.");
    await requireFactoryAccess(c.factory_id);
    await deleteAttachment(Number(s(fd, "attachmentId")), user.id);
    return "Dosya silindi.";
  }, detail(cid), s(fd, "returnTo"));
}

/* --- 9. Elden / telefonla şikâyet kaydı --------------------------------- */

export async function staffComplaintAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  let newId = 0;
  const res = await guard(async () => {
    const user = await requirePermission(PERMISSIONS.SIKAYET_KAYDET);
    if (!user.factory_id) throw new Error("Fabrika personeli olmayan kullanıcılar kayıt açamaz.");

    const productId = Number(s(fd, "product_id")) || null;
    const p = productId
      ? one<{ name: string; product_group: string; packaging: string | null }>(
          "SELECT name, product_group, packaging FROM products WHERE id = ?", productId,
        )
      : null;
    if (!p) throw new Error("Ürün seçimi zorunludur.");

    const files = fd.getAll("kanit").filter((f): f is File => f instanceof File && f.size > 0);
    const stored = [];
    for (const f of files) stored.push(await storeFile(f));

    const r = await createComplaint({
      channel: s(fd, "channel") || CHANNEL.TELEFON,
      originFactoryId: Number(s(fd, "origin_factory_id")) || user.factory_id,
      factoryId: user.factory_id,
      receivedAt: s(fd, "received_at") || undefined,
      receivedById: user.id,
      customerCompany: s(fd, "customer_company"),
      customerName: s(fd, "customer_name") || null,
      customerTitle: s(fd, "customer_title") || null,
      customerPhone: s(fd, "customer_phone"),
      customerEmail: s(fd, "customer_email") || null,
      customerAddress: s(fd, "customer_address") || null,
      customerProvince: s(fd, "customer_province") || null,
      customerTaxNo: s(fd, "customer_tax_no") || null,
      productId,
      productName: p.name,
      productGroup: p.product_group,
      packaging: p.packaging,
      lotNo: s(fd, "lot_no") || null,
      quantityKg: n(fd, "quantity_kg"),
      invoiceNo: s(fd, "invoice_no") || null,
      deliveryNoteNo: s(fd, "delivery_note_no") || null,
      contractNo: s(fd, "contract_no") || null,
      deliveryDate: s(fd, "delivery_date") || null,
      categoryId: Number(s(fd, "category_id")) || null,
      subject: s(fd, "subject"),
      description: s(fd, "description") || null,
      demand: s(fd, "demand") || DEMAND.IADE,
      kvkkConsent: s(fd, "kvkk") === "1",
      phoneVerified: false,
      attachments: stored,
    });
    newId = r.id;
    return `${r.complaintNo} numaralı şikâyet kaydı oluşturuldu.`;
  }, ["/panel", "/panel/sikayetler"]);

  if (res.ok && newId) {
    redirect(`/panel/sikayet/${newId}?m=${encodeURIComponent(res.message ?? "Şikâyet kaydı oluşturuldu.")}`);
  }
  return res;
}

/* --- 10. Bildirim giden kutusu ------------------------------------------ */

export async function retryNotificationAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    const user = await requireUser();
    if (!can(user.role, PERMISSIONS.BILDIRIM_GOR)) throw new Error("Yetkiniz yok.");
    const nid = Number(s(fd, "notificationId"));
    if (nid) {
      const ok = await deliver(nid);
      return ok ? "Bildirim yeniden gönderildi." : "Yeniden gönderim başarısız oldu.";
    }
    const count = await retryFailed();
    return `${count} bildirim yeniden gönderildi.`;
  }, ["/panel/bildirimler"], s(fd, "returnTo"));
}

/* --- 11. Ayarlar -------------------------------------------------------- */

export async function settingsAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    await requirePermission(PERMISSIONS.TANIM_YONET);
    let count = 0;
    for (const key of fd.keys()) {
      if (!key.startsWith("ayar_")) continue;
      setSetting(key.slice(5), s(fd, key));
      count++;
    }
    return `${count} ayar güncellendi.`;
  }, ["/panel/tanimlar", "/panel"], s(fd, "returnTo"));
}

export async function holidayAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    await requirePermission(PERMISSIONS.TANIM_YONET);
    const { run } = await import("@/lib/db");
    const date = s(fd, "date");
    if (s(fd, "sil") === "1") {
      run("DELETE FROM holidays WHERE date = ?", date);
      return "Resmî tatil kaydı silindi. SLA hesapları yeniden yapılacak.";
    }
    const name = s(fd, "name");
    if (!date || !name) throw new Error("Tarih ve tatil adı zorunludur.");
    run(
      "INSERT INTO holidays (date, name) VALUES (?, ?) ON CONFLICT(date) DO UPDATE SET name = excluded.name",
      date, name,
    );
    return "Resmî tatil kaydedildi.";
  }, ["/panel/tanimlar", "/panel/takvim"], s(fd, "returnTo"));
}

/** Yalnızca açık görevi olmayan görev kodlarını listeler — arayüz yardımcı. */
export async function openTaskCodes(complaintId: number): Promise<string[]> {
  await requireUser();
  return all<{ code: string }>(
    "SELECT code FROM tasks WHERE complaint_id = ? AND status IN ('BEKLEMEDE','DEVAM_EDIYOR')",
    complaintId,
  ).map((r) => r.code);
}


/* --- 12. Demo verisi ---------------------------------------------------- */

export async function generateDemoAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    await requirePermission(PERMISSIONS.TANIM_YONET);
    const { isDemoMode } = await import("@/server/settings");
    if (!isDemoMode()) {
      throw new Error("Demo verisi üretimi yalnızca DEMO_MODE=true iken kullanılabilir.");
    }
    const { generateDemoData } = await import("@/server/demo");
    const res = await generateDemoData({
      count: Number(s(fd, "count")) || 48,
      months: Number(s(fd, "months")) || 9,
    });
    return res.log.join(" ");
  }, ["/panel", "/panel/sikayetler", "/panel/raporlar", "/panel/tanimlar", "/panel/itirazlar", "/panel/gorevler"], s(fd, "returnTo"));
}

export async function clearDataAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    await requirePermission(PERMISSIONS.TANIM_YONET);
    const { isDemoMode } = await import("@/server/settings");
    if (!isDemoMode()) {
      throw new Error("Veri temizleme yalnızca DEMO_MODE=true iken kullanılabilir.");
    }
    if (s(fd, "onay") !== "SIL") {
      throw new Error('Onay alanına büyük harflerle "SIL" yazmanız gerekiyor.');
    }
    const { clearComplaintData } = await import("@/server/demo");
    const n = clearComplaintData();
    return `${n} şikâyet dosyası ve tüm bağlı kayıtlar silindi. Tanımlar ve kullanıcılar korundu.`;
  }, ["/panel", "/panel/sikayetler", "/panel/raporlar", "/panel/tanimlar"], s(fd, "returnTo"));
}
