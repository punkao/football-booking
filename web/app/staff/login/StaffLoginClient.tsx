"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ErrorBox, Ready } from "@/components/ui";
import { api } from "@/lib/client";
import { tx } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n";

export function StaffLoginClient({ lang, next, current }: { lang: Lang; next: string | null; current: { name: string; role: string } | null }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await api<{ next: string }>(lang, "/api/staff/login", { body: { username, password } });
    if (r.ok) {
      router.push(next ?? r.data.next);
      router.refresh();
      return;
    }
    setError(r.error.message);
    setBusy(false);
  };
  const logout = async () => {
    setBusy(true);
    await api(lang, "/api/staff/logout", { body: {} });
    router.refresh();
    setBusy(false);
  };

  return (
    <main className="page container">
      <Ready when={!busy} />
      <h1 className="page-title">{tx(lang, "เข้าสู่ระบบพนักงาน", "Staff login")}</h1>
      {next && (
        <div className="alert info" data-testid="login-required" style={{ maxWidth: 460, marginBottom: 12 }}>
          {tx(lang, "กรุณาเข้าสู่ระบบก่อนเข้าหน้านี้", "Please log in to open this page")}
        </div>
      )}
      {current && (
        <div className="alert ok" style={{ maxWidth: 460, marginBottom: 12 }} data-testid="staff-current">
          {tx(lang, "เข้าสู่ระบบอยู่", "Logged in as")}: {current.name} ({current.role}){" "}
          <button type="button" className="btn ghost small" data-testid="staff-logout" onClick={logout}>
            {tx(lang, "ออกจากระบบ", "Log out")}
          </button>
        </div>
      )}
      <form className="card form" style={{ maxWidth: 460 }} onSubmit={submit}>
        <label className="fld">
          <span>{tx(lang, "ชื่อผู้ใช้", "Username")}</span>
          <input type="text" data-testid="staff-username" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
        </label>
        <label className="fld">
          <span>{tx(lang, "รหัสผ่าน", "Password")}</span>
          <input type="password" data-testid="staff-password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <ErrorBox message={error} />
        <button type="submit" className="btn" data-testid="staff-login-submit" disabled={busy}>
          {tx(lang, "เข้าสู่ระบบ", "Log in")}
        </button>
      </form>
    </main>
  );
}
