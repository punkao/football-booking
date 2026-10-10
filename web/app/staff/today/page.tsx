import { Forbidden } from "@/components/Forbidden";
import { pageLang, requireStaffPage } from "@/lib/server/page";
import { TodayClient } from "./TodayClient";

// FR-22 (MANAGER, OWNER)
export default async function TodayPage() {
  const lang = await pageLang();
  const { staff, allowed } = await requireStaffPage("/staff/today", ["MANAGER", "OWNER"]);
  if (!allowed) return <Forbidden lang={lang} role={staff.role} />;
  return <TodayClient lang={lang} />;
}
