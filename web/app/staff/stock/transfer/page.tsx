import { Forbidden } from "@/components/Forbidden";
import { pageLang, requireStaffPage } from "@/lib/server/page";
import { TransferClient } from "./TransferClient";

// FR-39 (STAFF, MANAGER, OWNER)
export default async function Page() {
  const lang = await pageLang();
  const { staff, allowed } = await requireStaffPage("/staff/stock/transfer", ["STAFF", "MANAGER", "OWNER"]);
  if (!allowed) return <Forbidden lang={lang} role={staff.role} />;
  return <TransferClient lang={lang} role={staff.role} />;
}
