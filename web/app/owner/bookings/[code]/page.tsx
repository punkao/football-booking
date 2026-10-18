import { Forbidden } from "@/components/Forbidden";
import { pageLang, requireStaffPage } from "@/lib/server/page";
import { BookingHistoryClient } from "./BookingHistoryClient";

// FR-43 · BR-42 / BR-44 (OWNER, MANAGER)
export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const lang = await pageLang();
  const { staff, allowed } = await requireStaffPage(`/owner/bookings/${code}`, ["OWNER", "MANAGER"]);
  if (!allowed) return <Forbidden lang={lang} role={staff.role} />;
  return <BookingHistoryClient lang={lang} role={staff.role} code={decodeURIComponent(code)} />;
}
