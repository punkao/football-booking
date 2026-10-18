import { Forbidden } from "@/components/Forbidden";
import { pageLang, requireStaffPage } from "@/lib/server/page";
import { AuditClient } from "./AuditClient";

// FR-47 · BR-42 / BR-44 (OWNER only)
export default async function Page() {
  const lang = await pageLang();
  const { staff, allowed } = await requireStaffPage("/owner/audit", ["OWNER"]);
  if (!allowed) return <Forbidden lang={lang} role={staff.role} />;
  return <AuditClient lang={lang} role={staff.role} />;
}
