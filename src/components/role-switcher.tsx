"use client";

import { useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import type { DemoAccount } from "@/server/auth";
import { switchRoleAction } from "@/app/giris/actions";

/**
 * Demo modunda şifre sormadan rol değiştirme menüsü.
 * DEMO_MODE=false olduğunda sunucu tarafında hiç render edilmez.
 */
export default function RoleSwitcher({
  factories, currentUserId, currentLabel,
}: {
  factories: { id: number; short_name: string; accounts: DemoAccount[] }[];
  gm?: DemoAccount[];
  currentUserId: number;
  currentLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [factoryId, setFactoryId] = useState<number | null>(factories[0]?.id ?? null);
  const [pending, startTransition] = useTransition();
  const path = usePathname();

  const selected = factories.find((f) => f.id === factoryId);

  function go(userId: number) {
    startTransition(async () => {
      await switchRoleAction(userId, path);
    });
  }

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)}
              className="btn btn-secondary btn-sm" aria-expanded={open} aria-haspopup="dialog">
        <span className="hidden sm:inline">Rol değiştir</span>
        <span className="sm:hidden">Rol</span>
        <span aria-hidden className="text-ink-400">▾</span>
      </button>

      {open && (
        <>
          <button type="button" className="fixed inset-0 z-20 cursor-default"
                  aria-label="Menüyü kapat" onClick={() => setOpen(false)} />
          <div role="dialog" aria-label="Demo rol değiştirme"
               className="absolute right-0 z-30 mt-1.5 w-[min(92vw,30rem)] rounded-[6px] border border-ink-300 bg-white shadow-lg">
            <div className="border-b border-ink-200 bg-warn-50 px-3.5 py-2">
              <p className="text-xs font-semibold text-warn-700">Demo modu — rol değiştirme</p>
              <p className="mt-0.5 text-xs text-ink-600">
                Şu an: <strong>{currentLabel}</strong>. Şifre sorulmadan başka bir kullanıcıya geçer.
              </p>
            </div>

            <div className="max-h-[22rem] overflow-y-auto p-3.5">
              <label className="label" htmlFor="rs-factory">Fabrika</label>
              <select id="rs-factory" className="input mb-3"
                      value={factoryId ?? ""} onChange={(e) => setFactoryId(Number(e.target.value))}>
                {factories.map((f) => (
                  <option key={f.id} value={f.id}>{f.short_name}</option>
                ))}
              </select>

              <ul className="space-y-1">
                {selected?.accounts.map((a) => (
                  <li key={a.id}>
                    <button type="button" disabled={pending || a.id === currentUserId}
                            onClick={() => go(a.id)}
                            className={
                              "flex w-full items-center justify-between gap-2 rounded-[5px] border px-2.5 py-1.5 text-left text-sm transition-colors " +
                              (a.id === currentUserId
                                ? "border-brand-300 bg-brand-50 text-brand-800"
                                : "cursor-pointer border-transparent hover:border-ink-200 hover:bg-ink-50")
                            }>
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-ink-800">{a.title}</span>
                        <span className="block truncate text-xs text-ink-500">{a.full_name}</span>
                      </span>
                      {a.id === currentUserId && <span className="chip border-brand-200 bg-white text-brand-700">aktif</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
