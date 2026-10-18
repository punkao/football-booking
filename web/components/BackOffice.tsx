"use client";

// Shared pieces of the v2 back office: tabs that show only what the role may open (BR-44 · BR-36) and a loader hook.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import { tx } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n";

export function BackTabs({ lang, role }: { lang: Lang; role: string }) {
  const path = usePathname();
  const tabs: { href: string; id: string; label: string; roles: string[] }[] = [
    { href: "/owner/dashboard", id: "tab-dashboard", label: tx(lang, "แดชบอร์ด", "Dashboard"), roles: ["OWNER", "MANAGER"] },
    { href: "/owner/bookings", id: "tab-bookings", label: tx(lang, "การจองทั้งหมด", "All bookings"), roles: ["OWNER", "MANAGER"] },
    { href: "/staff/stock", id: "tab-stock", label: tx(lang, "คลังของ", "Stock"), roles: ["OWNER", "MANAGER", "STAFF"] },
    { href: "/staff/stock/sale", id: "tab-sale", label: tx(lang, "ขายหน้าเคาน์เตอร์", "Counter sale"), roles: ["OWNER", "MANAGER", "STAFF"] },
    { href: "/staff/stock/transfer", id: "tab-transfer", label: tx(lang, "ย้ายของ", "Move items"), roles: ["OWNER", "MANAGER", "STAFF"] },
    { href: "/manager/stock", id: "tab-manager-stock", label: tx(lang, "รับเข้า/ชำรุด/ปรับยอด", "Receive / damage / adjust"), roles: ["OWNER", "MANAGER"] },
    { href: "/owner/chats", id: "tab-chats", label: tx(lang, "ประวัติแชท", "Chat history"), roles: ["OWNER", "MANAGER"] },
    { href: "/owner/reports", id: "tab-reports", label: tx(lang, "รายงาน", "Reports"), roles: ["OWNER"] },
    { href: "/owner/audit", id: "tab-audit", label: tx(lang, "บันทึกการกระทำ", "Audit log"), roles: ["OWNER"] },
  ];
  return (
    <nav className="back-tabs" aria-label={tx(lang, "เมนูหลังบ้าน", "Back-office menu")}>
      {tabs
        .filter((t) => t.roles.includes(role))
        .map((t) => (
          <Link key={t.href} href={t.href} data-testid={t.id} aria-current={path === t.href ? "page" : undefined}>
            {t.label}
          </Link>
        ))}
    </nav>
  );
}

/** GET a back-office API; `reload` refetches (after an action) */
export function useLoad<T>(lang: Lang, path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(!!path);
  const reload = useCallback(async () => {
    if (!path) return;
    setBusy(true);
    const r = await api<T>(lang, path);
    if (r.ok) {
      setData(r.data);
      setError(null);
    } else setError(r.error.message);
    setBusy(false);
  }, [lang, path]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch
    void reload();
  }, [reload]);
  return { data, error, busy, reload, setError };
}
