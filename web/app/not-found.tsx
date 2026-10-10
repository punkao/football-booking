import Link from "next/link";
import { Ready } from "@/components/ui";
import { tx } from "@/lib/i18n";
import { pageLang } from "@/lib/server/page";

export default async function NotFound() {
  const lang = await pageLang();
  return (
    <main className="page container">
      <Ready />
      <h1 className="page-title" data-testid="not-found">
        {tx(lang, "ไม่พบหน้านี้", "Page not found")}
      </h1>
      <Link href="/" className="btn">
        {tx(lang, "กลับหน้าแรก", "Back to home")}
      </Link>
    </main>
  );
}
