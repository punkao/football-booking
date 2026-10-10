import Link from "next/link";
import { Ready } from "@/components/ui";
import { msg, tx } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n";

export function Forbidden({ lang, role }: { lang: Lang; role: string }) {
  return (
    <main className="page container">
      <Ready />
      <div className="alert error" data-testid="forbidden-message" role="alert">
        {msg(lang, "FORBIDDEN_ROLE")} ({role})
      </div>
      <p>
        <Link href="/staff/login" className="btn ghost" data-testid="forbidden-switch-user">
          {tx(lang, "เปลี่ยนผู้ใช้", "Switch user")}
        </Link>
      </p>
    </main>
  );
}
