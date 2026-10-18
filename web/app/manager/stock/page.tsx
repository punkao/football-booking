import { Forbidden } from "@/components/Forbidden";
import { pageLang, requireStaffPage } from "@/lib/server/page";
import { ManagerStockClient } from "./ManagerStockClient";

// FR-40 · BR-36 (MANAGER, OWNER)
export default async function Page() {
  const lang = await pageLang();
  const { staff, allowed } = await requireStaffPage("/manager/stock", ["MANAGER", "OWNER"]);
  if (!allowed) return <Forbidden lang={lang} role={staff.role} />;
  return <ManagerStockClient lang={lang} role={staff.role} />;
}
