/* ===========================================================================
   Oturum yönetimi.
   Oturum kimliği HMAC ile imzalanmış httpOnly çerezde taşınır; oturum kaydı
   sessions tablosunda tutulur, böylece sunucu tarafından iptal edilebilir.
   =========================================================================== */

import crypto from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { all, one, run } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { can, isGmRole, type Permission, type Role } from "@/lib/roles";
import { isDemoMode } from "./settings";

const COOKIE = "turkseker_oturum";
const SESSION_DAYS = 1;

export interface SessionUser {
  id: number;
  username: string;
  full_name: string;
  title: string;
  role: Role;
  factory_id: number | null;
  factory_code: string | null;
  factory_name: string | null;
  department_id: number | null;
  department_code: string | null;
  department_name: string | null;
  email: string | null;
}

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "SESSION_SECRET tanımlı değil veya çok kısa. .env.local dosyasında en az 32 karakterlik " +
        "bir değer belirleyin.",
      );
    }
    return "gelistirme-ortami-icin-gecici-anahtar";
  }
  return s;
}

function sign(value: string): string {
  const mac = crypto.createHmac("sha256", secret()).update(value).digest("base64url");
  return `${value}.${mac}`;
}

function unsign(signed: string | undefined): string | null {
  if (!signed) return null;
  const i = signed.lastIndexOf(".");
  if (i < 1) return null;
  const value = signed.slice(0, i);
  const mac = signed.slice(i + 1);
  const expected = crypto.createHmac("sha256", secret()).update(value).digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return value;
}

const USER_SELECT = `
  SELECT u.id, u.username, u.full_name, u.title, u.role, u.factory_id, u.department_id, u.email,
         f.code AS factory_code, f.name AS factory_name,
         d.code AS department_code, d.name AS department_name
    FROM users u
    LEFT JOIN factories f ON f.id = u.factory_id
    LEFT JOIN departments d ON d.id = u.department_id
`;

function loadUser(id: number): SessionUser | undefined {
  return one<SessionUser>(`${USER_SELECT} WHERE u.id = ? AND u.is_active = 1`, id);
}

/* --- Oturum açma / kapama ------------------------------------------------ */

export interface LoginResult {
  ok: boolean;
  error?: string;
  user?: SessionUser;
}

export async function login(username: string, password: string): Promise<LoginResult> {
  const uname = (username ?? "").trim().toLocaleLowerCase("tr-TR");
  if (!uname || !password) return { ok: false, error: "Kullanıcı adı ve şifre zorunludur." };

  const row = one<{ id: number; password_hash: string; is_active: number }>(
    "SELECT id, password_hash, is_active FROM users WHERE username = ?",
    uname,
  );
  if (!row || !row.is_active || !verifyPassword(password, row.password_hash)) {
    return { ok: false, error: "Kullanıcı adı veya şifre hatalı." };
  }

  await startSession(row.id);
  return { ok: true, user: loadUser(row.id) };
}

/** Kullanıcı için oturum açar ve çerezi yazar. */
export async function startSession(userId: number): Promise<void> {
  const sid = crypto.randomBytes(24).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  run(
    "INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)",
    sid, userId, expires.toISOString().slice(0, 19).replace("T", " "),
  );
  run("UPDATE users SET last_login_at = datetime('now') WHERE id = ?", userId);

  const store = await cookies();
  store.set(COOKIE, sign(sid), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
}

export async function logout(): Promise<void> {
  const store = await cookies();
  const sid = unsign(store.get(COOKIE)?.value);
  if (sid) run("DELETE FROM sessions WHERE id = ?", sid);
  store.delete(COOKIE);
}

/* --- Geçerli kullanıcı --------------------------------------------------- */

/**
 * Sunucu tarafında geçici kimlik devri.
 * Yalnızca demo verisi üreticisi kullanır: üretilen kayıtların gerçek iş
 * kuralları motorundan (yetki kontrolleriyle birlikte) geçmesini sağlar.
 * Çerez tabanlı oturumu değiştirmez, yalnızca verilen fonksiyonun çağrı
 * zincirinde geçerlidir.
 */
const actAsStore = new AsyncLocalStorage<SessionUser>();

export function runAs<T>(userId: number, fn: () => Promise<T>): Promise<T> {
  const u = loadUser(userId);
  if (!u) throw new Error(`Kullanıcı bulunamadı: ${userId}`);
  return actAsStore.run(u, fn);
}

/** Verilen rolü taşıyan fabrika personeli olarak çalıştırır. */
export function runAsRole<T>(factoryId: number, role: string, fn: () => Promise<T>): Promise<T> {
  const u = one<{ id: number }>(
    "SELECT id FROM users WHERE factory_id = ? AND role = ? AND is_active = 1 ORDER BY id LIMIT 1",
    factoryId, role,
  );
  if (!u) throw new Error(`${role} rolünde personel bulunamadı (fabrika ${factoryId}).`);
  return runAs(u.id, fn);
}

export async function currentUser(): Promise<SessionUser | null> {
  const impersonated = actAsStore.getStore();
  if (impersonated) return impersonated;

  const store = await cookies();
  const sid = unsign(store.get(COOKIE)?.value);
  if (!sid) return null;

  const s = one<{ user_id: number }>(
    "SELECT user_id FROM sessions WHERE id = ? AND expires_at > datetime('now')",
    sid,
  );
  if (!s) return null;
  return loadUser(s.user_id) ?? null;
}

/** Oturum yoksa hata atar — korumalı sunucu eylemlerinde kullanılır. */
export async function requireUser(): Promise<SessionUser> {
  const u = await currentUser();
  if (!u) throw new Error("Bu işlem için oturum açmanız gerekiyor.");
  return u;
}

export async function requirePermission(p: Permission): Promise<SessionUser> {
  const u = await requireUser();
  if (!can(u.role, p)) {
    throw new Error(`Bu işlem için yetkiniz bulunmuyor (${u.title}).`);
  }
  return u;
}

/** Kullanıcının belirli bir fabrikanın dosyasına erişip erişemeyeceği. */
export function canAccessFactory(user: SessionUser, factoryId: number): boolean {
  if (isGmRole(user.role) || user.role === "SISTEM_YONETICISI") return true;
  return user.factory_id === factoryId;
}

export async function requireFactoryAccess(factoryId: number): Promise<SessionUser> {
  const u = await requireUser();
  if (!canAccessFactory(u, factoryId)) {
    throw new Error("Bu dosya başka bir fabrikaya ait; görüntüleme yetkiniz yok.");
  }
  return u;
}

/* --- Demo rol değiştirici ------------------------------------------------ */

export interface DemoAccount {
  id: number;
  username: string;
  full_name: string;
  title: string;
  role: string;
  factory_name: string | null;
  factory_code: string | null;
  department_name: string | null;
}

/** Demo modunda hızlı geçiş menüsünde listelenecek hesaplar. */
export function demoAccounts(factoryId?: number | null): DemoAccount[] {
  if (!isDemoMode()) return [];
  if (factoryId) {
    return all<DemoAccount>(
      `SELECT u.id, u.username, u.full_name, u.title, u.role,
              f.name AS factory_name, f.code AS factory_code, d.name AS department_name
         FROM users u
         LEFT JOIN factories f ON f.id = u.factory_id
         LEFT JOIN departments d ON d.id = u.department_id
        WHERE u.is_demo = 1 AND u.is_active = 1 AND u.factory_id = ?
        ORDER BY u.id`,
      factoryId,
    );
  }
  return all<DemoAccount>(
    `SELECT u.id, u.username, u.full_name, u.title, u.role,
            f.name AS factory_name, f.code AS factory_code, d.name AS department_name
       FROM users u
       LEFT JOIN factories f ON f.id = u.factory_id
       LEFT JOIN departments d ON d.id = u.department_id
      WHERE u.is_demo = 1 AND u.is_active = 1 AND u.factory_id IS NULL
      ORDER BY u.id`,
  );
}

/**
 * Demo modunda şifre sormadan başka bir role geçer.
 * DEMO_MODE=false iken çalışmaz.
 */
export async function switchDemoUser(userId: number): Promise<SessionUser> {
  if (!isDemoMode()) throw new Error("Rol değiştirme yalnızca demo modunda kullanılabilir.");
  const target = one<{ id: number; is_demo: number }>(
    "SELECT id, is_demo FROM users WHERE id = ? AND is_active = 1",
    userId,
  );
  if (!target || !target.is_demo) throw new Error("Geçersiz demo hesabı.");

  await logout();
  await startSession(target.id);
  return loadUser(target.id)!;
}

/** Süresi geçmiş oturumları temizler. */
export function pruneSessions(): void {
  run("DELETE FROM sessions WHERE expires_at <= datetime('now')");
}

/**
 * Sayfa bileşenleri için oturum kontrolü.
 * Next.js App Router'da düzen (layout) ve sayfa paralel render edildiğinden
 * düzendeki yönlendirme sayfanın çalışmasını engellemez; her korumalı sayfa
 * oturumu kendisi doğrulamalıdır.
 */
export async function requirePageUser(next = "/panel"): Promise<SessionUser> {
  const u = await currentUser();
  if (!u) redirect(`/giris?next=${encodeURIComponent(next)}`);
  return u;
}
