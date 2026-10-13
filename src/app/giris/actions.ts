"use server";

import { redirect } from "next/navigation";
import { login, logout, switchDemoUser } from "@/server/auth";

export interface LoginState {
  error?: string;
  username?: string;
}

export async function loginAction(_prev: LoginState, fd: FormData): Promise<LoginState> {
  const username = String(fd.get("username") ?? "").trim();
  const password = String(fd.get("password") ?? "");
  const next = String(fd.get("next") ?? "/panel");

  const res = await login(username, password);
  if (!res.ok) return { error: res.error, username };
  redirect(next.startsWith("/") ? next : "/panel");
}

export async function logoutAction(): Promise<void> {
  await logout();
  redirect("/giris");
}

/** Demo modunda şifre sormadan rol değiştirir. */
export async function switchRoleAction(userId: number, returnTo?: string): Promise<void> {
  await switchDemoUser(userId);
  redirect(returnTo && returnTo.startsWith("/") ? returnTo : "/panel");
}
