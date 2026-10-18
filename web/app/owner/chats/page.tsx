import { Forbidden } from "@/components/Forbidden";
import { pageLang, requireStaffPage } from "@/lib/server/page";
import { ChatsClient } from "./ChatsClient";

// FR-36 · BR-44 / BR-45 (OWNER, MANAGER)
export default async function Page() {
  const lang = await pageLang();
  const { staff, allowed } = await requireStaffPage("/owner/chats", ["OWNER", "MANAGER"]);
  if (!allowed) return <Forbidden lang={lang} role={staff.role} />;
  return <ChatsClient lang={lang} role={staff.role} />;
}
