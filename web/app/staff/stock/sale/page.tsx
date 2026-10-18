import { Forbidden } from "@/components/Forbidden";
import { pageLang, requireStaffPage } from "@/lib/server/page";
import { SaleClient } from "./SaleClient";

// FR-38 (STAFF, MANAGER, OWNER)
export default async function Page() {
  const lang = await pageLang();
  const { staff, allowed } = await requireStaffPage("/staff/stock/sale", ["STAFF", "MANAGER", "OWNER"]);
  if (!allowed) return <Forbidden lang={lang} role={staff.role} />;
  return <SaleClient lang={lang} role={staff.role} />;
}
