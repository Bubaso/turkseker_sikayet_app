"use server";

import { redirect } from "next/navigation";
import { findForTracking } from "@/server/complaints";

export interface LookupState {
  error?: string;
}

/** Şikâyet no + telefon son 4 hane ile takip sayfasına yönlendirir. */
export async function lookupAction(_prev: LookupState, fd: FormData): Promise<LookupState> {
  const no = String(fd.get("no") ?? "").trim();
  const last4 = String(fd.get("last4") ?? "").replace(/\D/g, "");

  if (!no) return { error: "Şikâyet numaranızı giriniz." };
  if (last4.length !== 4) return { error: "Telefonunuzun son 4 hanesini giriniz." };

  const c = findForTracking(no, last4);
  if (!c) {
    return {
      error:
        "Bu şikâyet numarası ve telefon bilgisiyle kayıt bulunamadı. " +
        "Numarayı SMS'teki gibi (örnek: 2026-ANK-0001) yazdığınızdan emin olunuz.",
    };
  }
  redirect(`/takip/${c.tracking_token}`);
}
