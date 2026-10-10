import { freeHoursAvailable, todayOf } from "@/lib/rules";
import { pageCustomer, pageLang, pageNow } from "@/lib/server/page";
import { NewBookingClient } from "./NewBookingClient";

export default async function NewBookingPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const lang = await pageLang();
  const sp = await searchParams;
  const c = await pageCustomer();
  const now = await pageNow();
  const member =
    c && c.passwordHash
      ? { name: c.name, phone: c.phone, creditBalance: c.creditBalance, freeHours: freeHoursAvailable(c.paidHours, c.freeHoursUsed), paidHours: c.paidHours }
      : null;
  const start = sp.start !== undefined && sp.start !== "" ? Number(sp.start) : 19;
  return (
    <NewBookingClient
      lang={lang}
      member={member}
      initial={{ fieldId: sp.field ?? "A", date: sp.date ?? todayOf(now), startHour: Number.isFinite(start) ? start : 19 }}
    />
  );
}
