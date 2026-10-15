"use server";

/* ===========================================================================
   Panel sunucu eylemleri. Tümü aynı sonuç biçimini döndürür; istemci tarafı
   <ActionForm> bileşeni bu biçimi okuyarak hata/başarı mesajını gösterir.
   =========================================================================== */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { all, one } from "@/lib/db";
import { CHANNEL, DEMAND, VERDICT, type Verdict } from "@/lib/domain";
import { ASAMA, ASAMALAR, EKIP_ASAMALARI, type AsamaKodu } from "@/lib/asamalar";
import { PERMISSIONS, can, isGmRole } from "@/lib/roles";
import { requireFactoryAccess, requirePermission, requireUser } from "@/server/auth";
import {
  asamaYetkisi, asamayiGerekmez, asamayiKaydet, dosyayiIptalEt, dosyayiKapat,
  dosyayiYonlendir, ekibiKur,
} from "@/server/asama";
import { atanabilirPersonel, sorumluyuDegistir } from "@/server/asamalar-db";
import { createComplaint } from "@/server/complaints";
import { deleteAttachment, recordAttachment, storeFile, type StoredFile } from "@/server/attachments";
import { EVENT_TYPE, logEvent } from "@/server/events";
import { deliver, retryFailed } from "@/server/notify";
import { setSetting } from "@/server/settings";
import { yaziyiOkunduIsaretle } from "@/server/yonetim";

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

/* --- 1. Ekip oluşturma ve yönlendirme ------------------------------------ */

/**
 * Ekip kurma. Fabrika Müdürü kaç kişi olacağını seçer, her satırda unvan ve
 * isim belirler. Form "uye_0", "uye_1" … alanlarını gönderir.
 */
export async function formTeamAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const cid = id(fd);
  return guard(async () => {
    const uyeler: { userId: number; unvan: string }[] = [];
    for (const [k, v] of fd.entries()) {
      if (!k.startsWith("uye_")) continue;
      const uid = Number(String(v));
      if (!uid) continue;
      const unvan = s(fd, `unvan_${k.slice(4)}`);
      uyeler.push({ userId: uid, unvan: unvan || "—" });
    }
    // Hangi aşamanın kime düştüğü: gorev_<AŞAMA KODU> alanları.
    const gorevler = EKIP_ASAMALARI
      .map((kod) => ({ kod, userId: Number(s(fd, `gorev_${kod}`)) }))
      .filter((g) => Number.isFinite(g.userId) && g.userId > 0);

    await ekibiKur(cid, uyeler, s(fd, "note") || null, gorevler);
    return `${uyeler.length} kişilik ekip oluşturuldu ve aşamalar görevlendirildi.`;
  }, detail(cid), s(fd, "returnTo"));
}

export async function redirectAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const cid = id(fd);
  return guard(async () => {
    await dosyayiYonlendir(cid, Number(s(fd, "toFactoryId")), s(fd, "reason"));
    return "Dosya seçilen fabrikaya yönlendirildi.";
  }, [...detail(cid), "/panel/sikayetler"], s(fd, "returnTo"));
}

/* --- 2. Kilometre taşı kaydı (belge yükleyerek) -------------------------- */

/**
 * Tek bir eylem bütün belgeli aşamaları kapatır: tarih, kısa açıklama ve
 * belge. Belge uygulamada üretilmez; fabrikada hazırlanıp buraya yüklenir.
 */
export async function asamaAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const cid = id(fd);
  return guard(async () => {
    const kod = s(fd, "asama") as AsamaKodu;
    const a = ASAMALAR[kod];
    if (!a) throw new Error("Geçersiz aşama.");

    // Yetki ve sıra, belge yüklenmeden önce denetlenir.
    const { user } = await asamaYetkisi(cid, kod);

    // Dosyalar diske yazılır; ek kayıtları aşama kaydıyla aynı işlemde açılır.
    const belgeler: StoredFile[] = [];
    if (a.belgeli) {
      const dosyalar = fd.getAll("belge").filter((f): f is File => f instanceof File && f.size > 0);
      if (dosyalar.length === 0) {
        throw new Error(`Bu aşama belge yüklenerek kapanır: ${a.belgeAdi ?? "ilgili belge"}.`);
      }
      for (const f of dosyalar) belgeler.push(await storeFile(f));
    }

    await asamayiKaydet(cid, kod, {
      tarih: s(fd, "tarih"),
      not: s(fd, "not"),
      belgeler,
      karar: (s(fd, "karar") || undefined) as Verdict | undefined,
      itirazKabul: s(fd, "itirazKabul") === "1",
      iadeKg: n(fd, "iadeKg"), degisimKg: n(fd, "degisimKg"),
      bedel: n(fd, "bedel"), nakliye: n(fd, "nakliye"),
    });
    return `${a.baslik} kayda geçirildi.`;
  }, [...detail(cid), "/panel/itirazlar", "/panel/resmi-yazilar"], s(fd, "returnTo"));
}

export async function asamaGerekmezAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const cid = id(fd);
  return guard(async () => {
    await asamayiGerekmez(cid, s(fd, "asama") as AsamaKodu, s(fd, "gerekce"));
    return "Aşama atlandı olarak işaretlendi.";
  }, detail(cid), s(fd, "returnTo"));
}

/** Aşamanın sorumlusunu değiştirir — Fabrika Müdürü. */
export async function assignTaskAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const cid = id(fd);
  return guard(async () => {
    const user = await requirePermission(PERMISSIONS.GOREV_ATA);
    const taskId = Number(s(fd, "taskId"));
    const hedefId = Number(s(fd, "assigneeId"));
    const t = one<{ complaint_id: number; factory_id: number; title: string }>(
      `SELECT t.complaint_id, c.factory_id, t.title FROM tasks t
         JOIN complaints c ON c.id = t.complaint_id WHERE t.id = ?`, taskId,
    );
    if (!t || t.complaint_id !== cid) throw new Error("Aşama bulunamadı.");
    await requireFactoryAccess(t.factory_id);
    const aday = atanabilirPersonel(t.factory_id).find((u) => u.id === hedefId);
    if (!aday) throw new Error("Bu personel bu fabrikanın kadrosunda değil.");
    sorumluyuDegistir(taskId, hedefId, user);
    logEvent({
      complaintId: cid, type: EVENT_TYPE.GOREV,
      title: `Aşama sorumlusu değişti: ${t.title}`,
      note: `Yeni sorumlu: ${aday.full_name}`, actorId: user.id,
    });
    return `"${t.title}" aşamasının sorumlusu ${aday.full_name} olarak güncellendi.`;
  }, detail(cid), s(fd, "returnTo"));
}

/* --- 3. Kapanış ve iptal ------------------------------------------------- */

export async function closeAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const cid = id(fd);
  return guard(async () => {
    await dosyayiKapat(cid, s(fd, "note"));
    return "Dosya kapatıldı.";
  }, detail(cid), s(fd, "returnTo"));
}

export async function cancelAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const cid = id(fd);
  return guard(async () => {
    await dosyayiIptalEt(cid, s(fd, "reason"));
    return "Dosya iptal edildi.";
  }, detail(cid), s(fd, "returnTo"));
}

/* --- 4. Not ve ekler ----------------------------------------------------- */

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

/* --- 5. Elden / telefonla şikâyet kaydı ------------------------------- */
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

/** Daireye gelen resmî yazıyı okundu olarak işaretler (md. 6 ve 8). */

export async function letterReadAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    const user = await requireUser();
    const departmentId = Number(s(fd, "departmentId"));
    if (!isGmRole(user.role) && user.role !== "SISTEM_YONETICISI") {
      throw new Error("Resmî yazı kutusu Genel Müdürlük kullanıcılarına açıktır.");
    }
    if (user.department_id && user.department_id !== departmentId) {
      throw new Error("Bu yazı başka bir Daire Başkanlığına gönderilmiş.");
    }
    yaziyiOkunduIsaretle(Number(s(fd, "letterId")), departmentId, user.id);
    return "Yazı okundu olarak işaretlendi.";
  }, ["/panel/resmi-yazilar", "/panel"], s(fd, "returnTo"));
}

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
