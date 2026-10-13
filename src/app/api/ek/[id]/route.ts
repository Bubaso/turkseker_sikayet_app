import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { canAccessFactory, currentUser } from "@/server/auth";
import { getAttachment, uploadDir } from "@/server/attachments";

/**
 * RFC 6266 / RFC 8187 uyumlu Content-Disposition başlığı üretir.
 * Türkçe karakterli dosya adları için UTF-8 kodlu "filename*" parametresinin
 * yanına, bunu desteklemeyen eski istemciler için ASCII bir yedek ad konur.
 */
function contentDisposition(fileName: string, inline: boolean): string {
  const tr: Record<string, string> = {
    ş: "s", Ş: "S", ğ: "g", Ğ: "G", ı: "i", İ: "I",
    ö: "o", Ö: "O", ü: "u", Ü: "U", ç: "c", Ç: "C",
  };
  const ascii = fileName
    .replace(/[şŞğĞıİöÖüÜçÇ]/g, (c) => tr[c] ?? c)
    // Başlıkta sorun çıkaran karakterler (tırnak, ters bölü, kontrol karakterleri)
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/["\\]/g, "_")
    .slice(0, 150) || "dosya";
  const tip = inline ? "inline" : "attachment";
  return `${tip}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

/**
 * Ek dosyaları servis eder. Yalnızca oturum açmış ve dosyanın bağlı olduğu
 * fabrikaya erişimi olan kullanıcılar indirebilir.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return new NextResponse("Yetkisiz erişim.", { status: 401 });

  const { id } = await params;
  const a = getAttachment(Number(id));
  if (!a) return new NextResponse("Dosya bulunamadı.", { status: 404 });

  const { one } = await import("@/lib/db");
  const c = one<{ factory_id: number }>(
    "SELECT factory_id FROM complaints WHERE id = ?", a.complaint_id,
  );
  if (!c || !canAccessFactory(user, c.factory_id)) {
    return new NextResponse("Bu dosyaya erişim yetkiniz yok.", { status: 403 });
  }

  try {
    const buf = await fs.readFile(path.join(uploadDir(), a.stored_name));
    const inline = a.mime.startsWith("image/") || a.mime === "application/pdf";
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": a.mime,
        "Content-Length": String(buf.length),
        "Content-Disposition": contentDisposition(a.file_name, inline),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return new NextResponse("Dosya diskte bulunamadı.", { status: 410 });
  }
}
