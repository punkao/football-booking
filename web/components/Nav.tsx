"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { tx } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n";

export function Nav({ lang, staffRole }: { lang: Lang; staffRole: string | null }) {
  const path = usePathname();
  const links: { href: string; id: string; label: string }[] = [
    { href: "/", id: "nav-home", label: tx(lang, "หน้าแรก", "Home") },
    { href: "/book", id: "nav-book", label: tx(lang, "ตารางว่าง", "Availability") },
    { href: "/fields", id: "nav-fields", label: tx(lang, "สนาม", "Fields") },
    { href: "/challenges", id: "nav-challenges", label: tx(lang, "หาคู่แข่ง", "Challenges") },
    { href: "/series", id: "nav-series", label: tx(lang, "จองประจำ", "Recurring") },
    { href: "/my", id: "nav-my", label: tx(lang, "การจองของฉัน", "My bookings") },
  ];
  if (staffRole) {
    links.push({ href: "/staff", id: "nav-staff", label: tx(lang, "หน้าสนาม", "Front desk") });
    links.push({ href: "/staff/stock", id: "nav-stock", label: tx(lang, "คลังของ", "Stock") });
    if (staffRole !== "STAFF") links.push({ href: "/staff/today", id: "nav-staff-today", label: tx(lang, "ภาพรวมวันนี้", "Today") });
    // BR-44: the back office is for OWNER and MANAGER only
    if (staffRole !== "STAFF") links.push({ href: "/owner/dashboard", id: "nav-backoffice", label: tx(lang, "หลังบ้าน", "Back office") });
    if (staffRole === "OWNER") links.push({ href: "/owner", id: "nav-owner", label: tx(lang, "เจ้าของ", "Owner") });
  } else {
    links.push({ href: "/staff/login", id: "nav-staff-login", label: tx(lang, "พนักงาน", "Staff") });
  }
  return (
    <nav className="nav" aria-label={tx(lang, "เมนูหลัก", "Main menu")}>
      {links.map((l) => (
        <Link key={l.href} href={l.href} data-testid={l.id} aria-current={path === l.href ? "page" : undefined}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
