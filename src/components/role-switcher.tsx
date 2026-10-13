"use client";

import { useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import type { DemoAccount } from "@/server/auth";
import { switchRoleAction } from "@/app/giris/actions";

export interface FactoryGroup {
  id: number;
  /** "Susurluk" — satır altlarında kısa gösterim için. */
  short_name: string;
  /** "Susurluk Şeker Fabrikası" — açılır listede tam ad gösterilir. */
  name: string;
  accounts: DemoAccount[];
}

/**
 * Demo modunda şifre sormadan rol değiştirme menüsü.
 * Fabrika personeli ve Genel Müdürlük kadrosu iki sekmede toplanır.
 * DEMO_MODE=false olduğunda sunucu tarafında hiç render edilmez.
 */
export default function RoleSwitcher({
  factories, gmAccounts, currentUserId, currentLabel, currentFactoryId, isGm,
}: {
  factories: FactoryGroup[];
  gmAccounts: DemoAccount[];
  currentUserId: number;
  currentLabel: string;
  /** Oturumdaki kullanıcının fabrikası — menü o fabrikayla açılır. */
  currentFactoryId: number | null;
  /** Oturumdaki kullanıcı Genel Müdürlük kadrosundan mı — menü o sekmeyle açılır. */
  isGm: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"fabrika" | "gm">(isGm ? "gm" : "fabrika");
  const [factoryId, setFactoryId] = useState<number | null>(
    currentFactoryId ?? factories[0]?.id ?? null,
  );
  const [pending, startTransition] = useTransition();
  const path = usePathname();

  const selected = factories.find((f) => f.id === factoryId);
  const liste = tab === "fabrika" ? (selected?.accounts ?? []) : gmAccounts;

  function go(userId: number) {
    startTransition(async () => {
      await switchRoleAction(userId, path);
    });
  }

  const sekme = (anahtar: "fabrika" | "gm", etiket: string, sayi: number) => {
    const aktif = tab === anahtar;
    return (
      <button
        type="button"
        role="tab"
        aria-selected={aktif}
        onClick={() => setTab(anahtar)}
        className={
          "flex flex-1 items-center justify-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors " +
          (aktif
            ? "border-brand-600 text-brand-700"
            : "cursor-pointer border-transparent text-ink-500 hover:border-ink-300 hover:text-ink-700")
        }
      >
        {etiket}
        <span
          className={`tnum rounded-full px-1.5 text-[11px] ${
            aktif ? "bg-brand-100 text-brand-700" : "bg-ink-100 text-ink-600"
          }`}
        >
          {sayi}
        </span>
      </button>
    );
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="btn btn-secondary btn-sm"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span className="hidden sm:inline">Rol değiştir</span>
        <span className="sm:hidden">Rol</span>
        <span aria-hidden className="text-ink-400">▾</span>
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-20 cursor-default"
            aria-label="Menüyü kapat"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-label="Demo rol değiştirme"
            className="absolute right-0 z-30 mt-1.5 w-[min(92vw,30rem)] overflow-hidden rounded-[6px] border border-ink-300 bg-white shadow-lg"
          >
            <div className="border-b border-ink-200 bg-warn-50 px-3.5 py-2">
              <p className="text-xs font-semibold text-warn-700">Demo modu — rol değiştirme</p>
              <p className="mt-0.5 text-xs text-ink-600">
                Şu an: <strong>{currentLabel}</strong>. Şifre sorulmadan başka bir kullanıcıya geçer.
              </p>
            </div>

            <div role="tablist" aria-label="Kadro" className="flex border-b border-ink-200">
              {sekme("fabrika", "Fabrika", selected?.accounts.length ?? 0)}
              {sekme("gm", "Genel Müdürlük", gmAccounts.length)}
            </div>

            <div className="max-h-[24rem] overflow-y-auto p-3.5">
              {tab === "fabrika" && (
                <>
                  <label className="label" htmlFor="rs-factory">
                    <span className="mr-1.5 inline-flex size-4 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white">
                      1
                    </span>
                    Hangi fabrikada çalışacaksınız?
                  </label>
                  <select
                    id="rs-factory"
                    className="input"
                    value={factoryId ?? ""}
                    onChange={(e) => setFactoryId(Number(e.target.value))}
                  >
                    {factories.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                  <span className="hint mb-3">
                    Fabrikayı değiştirince aşağıdaki unvanlar o fabrikanın personeline döner.
                  </span>

                  <p className="label">
                    <span className="mr-1.5 inline-flex size-4 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white">
                      2
                    </span>
                    Hangi unvanla gireceksiniz?
                  </p>
                </>
              )}

              {tab === "gm" && (
                <p className="label">Genel Müdürlük kadrosundan birini seçin</p>
              )}

              {liste.length === 0 ? (
                <p className="py-4 text-center text-sm text-ink-500">
                  Bu kadroda tanımlı demo hesabı yok.
                </p>
              ) : (
                <ul className="space-y-1">
                  {liste.map((a) => (
                    <li key={a.id}>
                      <button
                        type="button"
                        disabled={pending || a.id === currentUserId}
                        onClick={() => go(a.id)}
                        className={
                          "flex w-full items-center justify-between gap-2 rounded-[5px] border px-2.5 py-1.5 text-left text-sm transition-colors " +
                          (a.id === currentUserId
                            ? "border-brand-300 bg-brand-50 text-brand-800"
                            : "cursor-pointer border-transparent hover:border-ink-200 hover:bg-ink-50")
                        }
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-ink-800">{a.title}</span>
                          <span className="block truncate text-xs text-ink-500">
                            {a.full_name}
                            {tab === "fabrika" && selected ? ` · ${selected.short_name}` : ""}
                            {tab === "gm" && a.department_name ? ` · ${a.department_name}` : ""}
                          </span>
                        </span>
                        {a.id === currentUserId && (
                          <span className="chip border-brand-200 bg-white text-brand-700">aktif</span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
