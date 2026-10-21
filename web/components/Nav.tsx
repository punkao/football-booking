"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { tx } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n";

type Item = { href: string; id: string; label: string };

export function Nav({ lang, staffRole }: { lang: Lang; staffRole: string | null }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  // เปลี่ยนหน้าแล้วพับเมนู · Esc พับเมนู
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- close the disclosure after navigating
    setOpen(false);
  }, [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const customer: Item[] = [
    { href: "/", id: "nav-home", label: tx(lang, "หน้าแรก", "Home") },
    { href: "/book", id: "nav-book", label: tx(lang, "ตารางว่าง", "Availability") },
    { href: "/fields", id: "nav-fields", label: tx(lang, "สนาม", "Fields") },
    { href: "/challenges", id: "nav-challenges", label: tx(lang, "หาคู่แข่ง", "Challenges") },
    { href: "/series", id: "nav-series", label: tx(lang, "จองประจำ", "Recurring") },
    { href: "/my", id: "nav-my", label: tx(lang, "การจองของฉัน", "My bookings") },
  ];
  const staff: Item[] = [];
  if (staffRole) {
    staff.push({ href: "/staff", id: "nav-staff", label: tx(lang, "หน้าสนาม", "Front desk") });
    staff.push({ href: "/staff/stock", id: "nav-stock", label: tx(lang, "คลังของ", "Stock") });
    if (staffRole !== "STAFF") staff.push({ href: "/staff/today", id: "nav-staff-today", label: tx(lang, "ภาพรวมวันนี้", "Today") });
    // BR-44: the back office is for OWNER and MANAGER only
    if (staffRole !== "STAFF") staff.push({ href: "/owner/dashboard", id: "nav-backoffice", label: tx(lang, "หลังบ้าน", "Back office") });
    if (staffRole === "OWNER") staff.push({ href: "/owner", id: "nav-owner", label: tx(lang, "เจ้าของ", "Owner") });
  } else {
    staff.push({ href: "/staff/login", id: "nav-staff-login", label: tx(lang, "พนักงาน", "Staff") });
  }
  const link = (l: Item) => (
    <Link key={l.href} href={l.href} data-testid={l.id} aria-current={path === l.href ? "page" : undefined}>
      {l.label}
    </Link>
  );
  return (
    <>
      <button type="button" className="menu-btn" aria-expanded={open} aria-controls="site-nav" onClick={() => setOpen((v) => !v)}>
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
          <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        {tx(lang, "เมนู", "Menu")}
      </button>
      <nav id="site-nav" className={open ? "nav open" : "nav"} aria-label={tx(lang, "เมนูหลัก", "Main menu")}>
        <div className="nav-group">
          {staffRole && <span className="nav-label">{tx(lang, "หน้าลูกค้า", "Customer pages")}</span>}
          {customer.map(link)}
        </div>
        <div className="nav-group">
          {staffRole && <span className="nav-label">{tx(lang, "พนักงาน", "Staff")}</span>}
          {staff.map(link)}
        </div>
      </nav>
    </>
  );
}
