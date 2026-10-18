import { Forbidden } from "@/components/Forbidden";
import { pageLang, requireStaffPage } from "@/lib/server/page";
import { StockClient } from "./StockClient";

// FR-37 / FR-41 (STAFF, MANAGER, OWNER)
export default async function Page() {
  const lang = await pageLang();
  const { staff, allowed } = await requireStaffPage("/staff/stock", ["STAFF", "MANAGER", "OWNER"]);
  if (!allowed) return <Forbidden lang={lang} role={staff.role} />;
  return <StockClient lang={lang} role={staff.role} />;
}
