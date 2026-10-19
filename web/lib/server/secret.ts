// R1 · NFR-18: the ONE place that decides the secret used to sign cookies, draft tokens and back-office chat refs.
// No secret in the code: a missing / short / old public value stops the web at start-up (instrumentation.ts),
// except on a test machine (ALLOW_TEST_RESET=1) where a random secret is made for this run only.
import { randomBytes } from "node:crypto";

export const MIN_SECRET_LENGTH = 32;
const KNOWN_PUBLIC = ["luknang-arena-session-secret"]; // was the code fallback until v2 B2 (public on GitHub)

export const HOW_TO_SET =
  'Set SESSION_SECRET in web/.env to at least 32 random characters, e.g. node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64url\'))" then restart: docker compose -f web/compose.yaml up -d';

export type SecretResult = { ok: true; secret: string; temporary: boolean } | { ok: false; message: string };

export function resolveSessionSecret(env: Record<string, string | undefined>): SecretResult {
  const s = (env.SESSION_SECRET ?? "").trim();
  const usable = s.length >= MIN_SECRET_LENGTH && !KNOWN_PUBLIC.some((k) => s.includes(k));
  if (usable) return { ok: true, secret: s, temporary: false };
  if (!s && env.ALLOW_TEST_RESET === "1") return { ok: true, secret: randomBytes(32).toString("hex"), temporary: true };
  const why = !s ? "SESSION_SECRET is not set" : s.length < MIN_SECRET_LENGTH ? `SESSION_SECRET is shorter than ${MIN_SECRET_LENGTH} characters` : "SESSION_SECRET is a public example value";
  return { ok: false, message: `${why}. ${HOW_TO_SET}` };
}

type G = { __lnSecret?: string };
const g = globalThis as unknown as G;

/** the secret of this process (resolved once) — throws when it is not usable */
export function sessionSecret(): string {
  if (g.__lnSecret) return g.__lnSecret;
  const r = resolveSessionSecret(process.env);
  if (!r.ok) throw new Error(r.message);
  if (r.temporary) console.warn("[secret] SESSION_SECRET not set: using a random secret for this run only (ALLOW_TEST_RESET=1). Sessions end when the web restarts.");
  g.__lnSecret = r.secret;
  return r.secret;
}
