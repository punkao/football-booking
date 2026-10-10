// Small fetch helper for client components. Errors always come back as { code, message } (07-SAD section 4).
import { msg } from "./i18n";
import type { Lang } from "./i18n";

export type ApiError = { code: string; message: string; params?: Record<string, unknown> };
export type ApiResult<T> = { ok: true; data: T; status: number } | { ok: false; error: ApiError; status: number };

export async function api<T = Record<string, unknown>>(
  lang: Lang,
  path: string,
  opts: { method?: string; body?: unknown } = {},
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, {
      method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
      headers: opts.body !== undefined ? { "content-type": "application/json" } : undefined,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      cache: "no-store",
      credentials: "same-origin",
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const e = (json as { error?: ApiError }).error;
      return { ok: false, status: res.status, error: e ?? { code: "INTERNAL", message: msg(lang, "INTERNAL") } };
    }
    return { ok: true, status: res.status, data: json as T };
  } catch {
    return { ok: false, status: 0, error: { code: "NETWORK", message: msg(lang, "NETWORK") } };
  }
}

export function mmss(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
