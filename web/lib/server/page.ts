import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { normLang } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n";
import { customerIdFrom, getNow, staffFrom } from "./core";
import type { StaffRow } from "./core";
import { loadCustomerById } from "./data";
import { ensureDb } from "./db";

export async function pageLang(): Promise<Lang> {
  return normLang((await cookies()).get("lang")?.value);
}

export async function pageCustomer() {
  const jar = await cookies();
  await ensureDb();
  return loadCustomerById(null, customerIdFrom((n) => jar.get(n)?.value));
}

export async function pageStaff(): Promise<StaffRow | null> {
  const jar = await cookies();
  await ensureDb();
  return staffFrom((n) => jar.get(n)?.value);
}

/** NFR-05: shop pages require login; wrong role → null (page shows a forbidden notice) */
export async function requireStaffPage(path: string, roles: StaffRow["role"][]): Promise<{ staff: StaffRow; allowed: boolean }> {
  const staff = await pageStaff();
  if (!staff) redirect(`/staff/login?next=${encodeURIComponent(path)}`);
  return { staff, allowed: roles.includes(staff.role) };
}

export async function pageNow(): Promise<Date> {
  await ensureDb();
  return getNow();
}
