import { pageLang, pageStaff } from "@/lib/server/page";
import { StaffLoginClient } from "./StaffLoginClient";

export default async function StaffLoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const staff = await pageStaff();
  const next = sp.next && sp.next.startsWith("/") && !sp.next.startsWith("//") ? sp.next : null;
  return <StaffLoginClient lang={await pageLang()} next={next} current={staff ? { name: staff.name, role: staff.role } : null} />;
}
