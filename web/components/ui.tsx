"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { money } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n";

/** sets <html data-ready> (NFR-09): "true" once this page's data is loaded, back to "false" while busy / on leave */
export function Ready({ when = true }: { when?: boolean }) {
  useEffect(() => {
    document.documentElement.dataset.ready = when ? "true" : "false";
  }, [when]);
  useEffect(
    () => () => {
      document.documentElement.dataset.ready = "false";
    },
    [],
  );
  return null;
}

export function LangToggle({ lang }: { lang: Lang }) {
  const router = useRouter();
  const set = (l: Lang) => {
    document.cookie = `lang=${l}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.dataset.ready = "false";
    router.refresh();
  };
  return (
    <div className="lang-toggle" role="group" aria-label="Language / ภาษา">
      <button type="button" data-testid="lang-th" aria-pressed={lang === "th"} onClick={() => set("th")}>
        TH
      </button>
      <button type="button" data-testid="lang-en" aria-pressed={lang === "en"} onClick={() => set("en")}>
        EN
      </button>
    </div>
  );
}

/** money with a machine-readable data-value (TH: ฿1,200 · EN: THB 1,200) */
export function Money({ lang, value, testid }: { lang: Lang; value: number; testid?: string }) {
  return (
    <span data-testid={testid} data-value={value}>
      {money(lang, value)}
    </span>
  );
}

export function ErrorBox({ message, testid = "error-message" }: { message: string | null | undefined; testid?: string }) {
  if (!message) return null;
  return (
    <div className="alert error" role="alert" data-testid={testid}>
      {message}
    </div>
  );
}

export function OkBox({ message, testid = "success-message" }: { message: string | null | undefined; testid?: string }) {
  if (!message) return null;
  return (
    <div className="alert ok" role="status" data-testid={testid}>
      {message}
    </div>
  );
}
