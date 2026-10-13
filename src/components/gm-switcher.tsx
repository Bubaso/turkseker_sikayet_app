"use client";

import { useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import type { DemoAccount } from "@/server/auth";
import { switchRoleAction } from "@/app/giris/actions";

/** Genel Müdürlük hesapları için demo rol değiştirici. */
export default function GmSwitcher({
  accounts, currentUserId,
}: {
  accounts: DemoAccount[]; currentUserId: number;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const path = usePathname();

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className="btn btn-secondary btn-sm"
              aria-expanded={open}>
        <span className="hidden sm:inline">Genel Müdürlük</span>
        <span className="sm:hidden">GM</span>
        <span aria-hidden className="text-ink-400">▾</span>
      </button>
      {open && (
        <>
          <button type="button" className="fixed inset-0 z-20 cursor-default"
                  aria-label="Menüyü kapat" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-30 mt-1.5 w-[min(92vw,26rem)] rounded-[6px] border border-ink-300 bg-white p-2 shadow-lg">
            <ul className="space-y-1">
              {accounts.map((a) => (
                <li key={a.id}>
                  <button type="button" disabled={pending || a.id === currentUserId}
                          onClick={() => startTransition(async () => { await switchRoleAction(a.id, path); })}
                          className={
                            "flex w-full flex-col items-start rounded-[5px] border px-2.5 py-1.5 text-left text-sm " +
                            (a.id === currentUserId
                              ? "border-brand-300 bg-brand-50 text-brand-800"
                              : "cursor-pointer border-transparent hover:border-ink-200 hover:bg-ink-50")
                          }>
                    <span className="font-medium text-ink-800">{a.title}</span>
                    <span className="text-xs text-ink-500">{a.full_name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
