import { Forbidden } from "@/components/Forbidden";
import { pageLang, requireStaffPage } from "@/lib/server/page";
import { DashboardClient } from "./DashboardClient";

// FR-42 · BR-44 (OWNER, MANAGER)
export default async function Page() {
  const lang = await pageLang();
  const { staff, allowed } = await requireStaffPage("/owner/dashboard", ["OWNER", "MANAGER"]);
  if (!allowed) return <Forbidden lang={lang} role={staff.role} />;
  return <DashboardClient lang={lang} role={staff.role} />;
}
