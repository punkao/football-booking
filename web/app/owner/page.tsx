import { Forbidden } from "@/components/Forbidden";
import { pageLang, requireStaffPage } from "@/lib/server/page";
import { OwnerClient } from "./OwnerClient";

// FR-26, FR-27 (OWNER)
export default async function OwnerPage() {
  const lang = await pageLang();
  const { staff, allowed } = await requireStaffPage("/owner", ["OWNER"]);
  if (!allowed) return <Forbidden lang={lang} role={staff.role} />;
  return <OwnerClient lang={lang} />;
}
