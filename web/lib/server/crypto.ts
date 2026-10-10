import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

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

const SECRET = process.env.SESSION_SECRET || "luknang-arena-session-secret";

/** signed cookie value: base64url(json).hmac */
export function sign(payload: unknown): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = createHmac("sha256", SECRET).update(body).digest("base64url");
  return `${body}.${mac}`;
}

export function unsign<T>(value: string | undefined | null): T | null {
  if (!value) return null;
  const i = value.lastIndexOf(".");
  if (i < 0) return null;
  const body = value.slice(0, i);
  const mac = value.slice(i + 1);
  const expect = createHmac("sha256", SECRET).update(body).digest("base64url");
  if (mac.length !== expect.length || !timingSafeEqual(Buffer.from(mac), Buffer.from(expect))) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString()) as T;
  } catch {
    return null;
  }
}

export function randomToken(bytes = 12): string {
  return randomBytes(bytes).toString("base64url");
}
