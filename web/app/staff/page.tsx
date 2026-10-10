import { Forbidden } from "@/components/Forbidden";
import { pageLang, requireStaffPage } from "@/lib/server/page";
import { StaffClient } from "./StaffClient";

// FR-23 – FR-25 (STAFF, MANAGER, OWNER)
export default async function StaffPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const lang = await pageLang();
  const { staff, allowed } = await requireStaffPage("/staff", ["STAFF", "MANAGER", "OWNER"]);
  if (!allowed) return <Forbidden lang={lang} role={staff.role} />;
  const sp = await searchParams;
  return <StaffClient lang={lang} staff={{ name: staff.name, role: staff.role }} initialCode={sp.code ?? ""} />;
}
