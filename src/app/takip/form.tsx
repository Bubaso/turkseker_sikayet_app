"use client";

import { useActionState } from "react";
import { Notice } from "@/components/ui";
import { lookupAction, type LookupState } from "./actions";

export default function LookupForm() {
  const [state, action, pending] = useActionState<LookupState, FormData>(lookupAction, {});

  return (
    <form action={action} className="space-y-4">
      {state.error && <Notice tone="danger">{state.error}</Notice>}

      <div>
        <label className="label" htmlFor="no">Şikâyet numaranız</label>
        <input id="no" name="no" className="input tnum font-mono" placeholder="2026-ANK-0001"
               autoComplete="off" autoCapitalize="characters" required />
        <span className="hint">Kayıt sonrası gönderilen SMS'te yer alır.</span>
      </div>

      <div className="w-44">
        <label className="label" htmlFor="last4">Telefonunuzun son 4 hanesi</label>
        <input id="last4" name="last4" inputMode="numeric" maxLength={4}
               className="input tnum text-center text-lg tracking-[0.25em]"
               placeholder="— — — —" required />
      </div>

      <button type="submit" disabled={pending} className="btn btn-primary">
        {pending ? "Sorgulanıyor…" : "Şikâyetimi göster"}
      </button>
    </form>
  );
}
