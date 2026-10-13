"use client";

import { useActionState } from "react";
import { Notice } from "@/components/ui";
import { loginAction, type LoginState } from "./actions";

export default function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      {state.error && <Notice tone="danger">{state.error}</Notice>}

      <div>
        <label className="label" htmlFor="username">Kullanıcı adı</label>
        <input id="username" name="username" className="input" required autoFocus
               autoComplete="username" defaultValue={state.username}
               placeholder="örnek: ank.mudur" />
      </div>
      <div>
        <label className="label" htmlFor="password">Şifre</label>
        <input id="password" name="password" type="password" className="input" required
               autoComplete="current-password" />
      </div>
      <button type="submit" disabled={pending} className="btn btn-primary w-full">
        {pending ? "Giriş yapılıyor…" : "Giriş yap"}
      </button>
    </form>
  );
}
