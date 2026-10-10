import { pageLang } from "@/lib/server/page";
import { SplitClient } from "./SplitClient";

export default async function SplitPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <SplitClient lang={await pageLang()} token={token} />;
}
