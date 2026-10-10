import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "@fontsource/prompt/400.css";
import "@fontsource/prompt/600.css";
import "@fontsource/prompt/700.css";
import "@fontsource/ibm-plex-sans-thai/400.css";
import "@fontsource/ibm-plex-sans-thai/600.css";
import "./globals.css";
import { Logo } from "@/components/Art";
import { LangToggle } from "@/components/ui";
import { Nav } from "@/components/Nav";
import { SHOP_NAME, tx } from "@/lib/i18n";
import { pageLang, pageStaff } from "@/lib/server/page";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await pageLang();
  return {
    title: lang === "en" ? "Luknang Arena · Football field booking" : "ลูกหนัง อารีน่า · จองสนามฟุตบอลหญ้าเทียม",
    description: lang === "en" ? "Artificial-turf football field booking" : "จองสนามฟุตบอลหญ้าเทียมออนไลน์",
  };
}

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0B3D2E" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await pageLang();
  let staffRole: string | null = null;
  try {
    staffRole = (await pageStaff())?.role ?? null;
  } catch {
    staffRole = null;
  }
  const bug = process.env.BUG_MODE === "1" ? "1" : "0";
  const shop = lang === "en" ? SHOP_NAME.en : SHOP_NAME.th;
  return (
    <html lang={lang} data-ready="false" data-bug-mode={bug} suppressHydrationWarning>
      <body>
        <a href="#main" className="sr-only">
          {tx(lang, "ข้ามไปเนื้อหา", "Skip to content")}
        </a>
        <header className="site-header">
          <div className="container">
            <div className="header-row">
              <Link href="/" className="brand" data-testid="brand-home">
                <Logo size={34} title={tx(lang, "โลโก้ลูกหนัง อารีน่า", "Luknang Arena logo")} />
                <span>{shop}</span>
              </Link>
              <LangToggle lang={lang} />
            </div>
            <Nav lang={lang} staffRole={staffRole} />
          </div>
        </header>
        <div id="main">{children}</div>
        <footer className="site-footer">
          <div className="container spread">
            <span>
              © 2026 {shop} · {tx(lang, "เปิด 08:00–24:00 ทุกวัน", "Open daily 08:00–24:00")}
            </span>
            <Link href="/project" data-testid="nav-project">
              {tx(lang, "เอกสารโครงการ", "Project docs")}
            </Link>
          </div>
        </footer>
      </body>
    </html>
  );
}
