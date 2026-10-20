import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { sessionSecret } from "./secret.ts";

// ADR-07: passwords stored as scrypt hashes
export function hashPassword(pw: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pw, salt, 32).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(pw: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const [kind, salt, hash] = stored.split("$");
  if (kind !== "scrypt" || !salt || !hash) return false;
  const a = Buffer.from(hash, "hex");
  const b = scryptSync(pw, salt, 32);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** signed cookie value: base64url(json).hmac */
export function sign(payload: unknown): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = createHmac("sha256", sessionSecret()).update(body).digest("base64url");
  return `${body}.${mac}`;
}

export function unsign<T>(value: string | undefined | null): T | null {
  if (!value) return null;
  const i = value.lastIndexOf(".");
  if (i < 0) return null;
  const body = value.slice(0, i);
  const mac = value.slice(i + 1);
  const expect = createHmac("sha256", sessionSecret()).update(body).digest("base64url");
  if (mac.length !== expect.length || !timingSafeEqual(Buffer.from(mac), Buffer.from(expect))) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString()) as T;
  } catch {
    return null;
  }
}

// ---------- CR-01: login cookies (ln_customer = cid · ln_staff = sid) ----------
export type SessionKey = "cid" | "sid";
export type SessionClaim = { id: number; expiresAt: number; legacy: boolean };

/** CR-01: a login cookie = signed { cid | sid, jti, exp } · jti is random so every login is a different token (logout ends only that one) */
export function signSession(key: SessionKey, id: number, maxAgeSec: number, nowMs = Date.now()): string {
  return sign({ [key]: id, jti: randomToken(16), exp: Math.floor(nowMs / 1000) + maxAgeSec });
}

/**
 * CR-01: the payload check of a login cookie (pure · the database part is checkSession in core.ts)
 * - { key, jti, exp }: until exp
 * - { key } only = issued before CR-01: until legacySinceMs (applied_at of migration 007) + the old lifetime,
 *   when every such cookie has expired in the browser anyway · unknown start → refused
 * - anything else (draft · ln_access · the other login cookie · bad id) → null
 */
export function readSession(
  token: string | undefined | null,
  key: SessionKey,
  maxAgeSec: number,
  nowMs: number,
  legacySinceMs: number | null,
): SessionClaim | null {
  const p = unsign<Record<string, unknown>>(token);
  if (!p || typeof p !== "object" || Array.isArray(p)) return null;
  const id = p[key];
  if (typeof id !== "number" || !Number.isInteger(id) || id <= 0) return null;
  const keys = Object.keys(p).sort().join(",");
  if (keys === key) {
    if (legacySinceMs === null) return null;
    const expiresAt = legacySinceMs + maxAgeSec * 1000;
    return nowMs < expiresAt ? { id, expiresAt, legacy: true } : null;
  }
  if (keys !== ["exp", "jti", key].sort().join(",")) return null;
  if (typeof p.jti !== "string" || p.jti.length < 16 || typeof p.exp !== "number") return null;
  const expiresAt = p.exp * 1000;
  return nowMs < expiresAt ? { id, expiresAt, legacy: false } : null;
}

/** CR-01: what the logout list stores — SHA-256 of the whole cookie value, never the cookie itself */
export function sessionHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** R9 / ADR-17: chat draft token = the same signed format, marked kind "draft" (a session cookie is never a draft) */
export function signDraft<T extends object>(d: T): string {
  return sign({ kind: "draft", ...d });
}

export function readDraft<T extends object>(token: unknown): ({ kind: "draft" } & T) | null {
  if (typeof token !== "string") return null;
  const d = unsign<{ kind?: unknown } & T>(token);
  return d && d.kind === "draft" ? (d as { kind: "draft" } & T) : null;
}

/** R11: a back-office reference for a chat room (HMAC of the room id) — never the customer's cookie value */
export function chatRef(sessionId: string): string {
  return createHmac("sha256", sessionSecret()).update("chat-ref:" + sessionId).digest("hex").slice(0, 32);
}

/** R2: the client IP is kept only as an HMAC (PDPA) */
export function ipRef(ip: string): string {
  return createHmac("sha256", sessionSecret()).update("ip:" + ip).digest("hex").slice(0, 32);
}

export function randomToken(bytes = 12): string {
  return randomBytes(bytes).toString("base64url");
}
