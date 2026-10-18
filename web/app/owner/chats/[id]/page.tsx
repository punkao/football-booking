import { Forbidden } from "@/components/Forbidden";
import { pageLang, requireStaffPage } from "@/lib/server/page";
import { ChatDetailClient } from "./ChatDetailClient";

// FR-36 · BR-44 / BR-45 (OWNER, MANAGER)
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lang = await pageLang();
  const { staff, allowed } = await requireStaffPage(`/owner/chats/${id}`, ["OWNER", "MANAGER"]);
  if (!allowed) return <Forbidden lang={lang} role={staff.role} />;
  return <ChatDetailClient lang={lang} role={staff.role} id={id} />;
}
