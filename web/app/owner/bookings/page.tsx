import { Forbidden } from "@/components/Forbidden";
import { pageLang, requireStaffPage } from "@/lib/server/page";
import { BookingsClient } from "./BookingsClient";

// FR-43 · BR-44 (OWNER, MANAGER)
export default async function Page() {
  const lang = await pageLang();
  const { staff, allowed } = await requireStaffPage("/owner/bookings", ["OWNER", "MANAGER"]);
  if (!allowed) return <Forbidden lang={lang} role={staff.role} />;
  return <BookingsClient lang={lang} role={staff.role} />;
}
