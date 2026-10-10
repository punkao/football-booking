import { pageLang } from "@/lib/server/page";
import { PayClient } from "./PayClient";

export default async function PayPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <PayClient lang={await pageLang()} code={decodeURIComponent(code)} />;
}
