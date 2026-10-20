// CR-01 · login cookies: a different token per login, one reader (readSession) for the new and the pre-CR-01 format,
// and only a hash of the cookie is ever stored for a logout — written first (red before the fix).
// Expected values: [D:CR-01] CHANGE-REQUESTS/answers/README.md (only the session that logged out · no change of the
// 30 days / 12 hours lifetimes · people logged in at the update keep working) · docs/impact/CR-01.md 3.1
import { test } from "node:test";
import assert from "node:assert/strict";

process.env.SESSION_SECRET = "s".repeat(40);
const { sign, signDraft, signSession, readSession, sessionHash } = await import("./crypto.ts");

const DAY = 24 * 60 * 60;
const NOW = Date.UTC(2026, 9, 21, 3, 0, 0); // real time of a request (not the app clock)
const SINCE = Date.UTC(2026, 9, 20, 13, 0, 0); // applied_at of migration 007 = when the update went live

test("CR-01 every login gets its own token (same account twice → two different cookies)", () => {
  const a = signSession("cid", 5, 30 * DAY, NOW);
  const b = signSession("cid", 5, 30 * DAY, NOW);
  assert.notEqual(a, b);
  assert.equal(readSession(a, "cid", 30 * DAY, NOW, null)?.id, 5);
  assert.equal(readSession(b, "cid", 30 * DAY, NOW, null)?.id, 5);
});

test("CR-01 the lifetime is not changed: customer 30 days, staff 12 hours, then refused", () => {
  const c = signSession("cid", 5, 30 * DAY, NOW);
  assert.equal(readSession(c, "cid", 30 * DAY, NOW, null)?.expiresAt, NOW + 30 * DAY * 1000);
  assert.ok(readSession(c, "cid", 30 * DAY, NOW + 30 * DAY * 1000 - 1000, null));
  assert.equal(readSession(c, "cid", 30 * DAY, NOW + 30 * DAY * 1000, null), null);
  const s = signSession("sid", 3, 12 * 3600, NOW);
  assert.equal(readSession(s, "sid", 12 * 3600, NOW, null)?.expiresAt, NOW + 12 * 3600 * 1000);
  assert.equal(readSession(s, "sid", 12 * 3600, NOW + 12 * 3600 * 1000, null), null);
});

test("CR-01 a cookie from before the update ({cid} / {sid} only) keeps working until it has surely expired in the browser", () => {
  const oldCustomer = sign({ cid: 5 });
  const oldStaff = sign({ sid: 3 });
  // customer: 30 days after the update · staff: 12 hours after the update
  assert.deepEqual(readSession(oldCustomer, "cid", 30 * DAY, NOW, SINCE), { id: 5, expiresAt: SINCE + 30 * DAY * 1000, legacy: true });
  assert.equal(readSession(oldCustomer, "cid", 30 * DAY, SINCE + 30 * DAY * 1000, SINCE), null);
  assert.equal(readSession(oldStaff, "sid", 12 * 3600, SINCE + 12 * 3600 * 1000 - 1, SINCE)?.id, 3);
  assert.equal(readSession(oldStaff, "sid", 12 * 3600, SINCE + 12 * 3600 * 1000, SINCE), null);
  // no migration 007 → the start of the grace period is unknown → refuse (fail closed)
  assert.equal(readSession(oldCustomer, "cid", 30 * DAY, NOW, null), null);
});

test("CR-01 other signed tokens are never a login (draft · ln_access · the other cookie · bad id · extra keys · tampered)", () => {
  const draft = signDraft({ sid: "5d7c1e0a-8b3f-4c2e-9a61-0f4b2d8e7c11", a: {}, exp: Math.floor(NOW / 1000) + 900 });
  assert.equal(readSession(draft, "sid", 12 * 3600, NOW, SINCE), null);
  assert.equal(readSession(sign({ codes: ["LN-900004"] }), "cid", 30 * DAY, NOW, SINCE), null);
  assert.equal(readSession(signSession("sid", 1, 12 * 3600, NOW), "cid", 30 * DAY, NOW, SINCE), null); // staff cookie as customer
  assert.equal(readSession(signSession("cid", 1, 30 * DAY, NOW), "sid", 12 * 3600, NOW, SINCE), null); // customer cookie as staff
  for (const bad of [{ cid: "5" }, { cid: 0 }, { cid: -1 }, { cid: 1.5 }, { cid: 5, admin: true }, { cid: 5, jti: "x".repeat(22) }]) {
    assert.equal(readSession(sign(bad), "cid", 30 * DAY, NOW, SINCE), null, JSON.stringify(bad));
  }
  assert.equal(readSession(sign({ cid: 5, jti: "short", exp: Math.floor(NOW / 1000) + 60 }), "cid", 30 * DAY, NOW, SINCE), null);
  const good = signSession("cid", 5, 30 * DAY, NOW);
  assert.equal(readSession(good.slice(0, -2) + "xx", "cid", 30 * DAY, NOW, SINCE), null);
  assert.equal(readSession(undefined, "cid", 30 * DAY, NOW, SINCE), null);
  assert.equal(readSession("", "cid", 30 * DAY, NOW, SINCE), null);
});

test("CR-01 only a SHA-256 hash of the cookie is stored for a logout (64 hex, never the cookie itself)", () => {
  const t = signSession("cid", 5, 30 * DAY, NOW);
  const h = sessionHash(t);
  assert.match(h, /^[0-9a-f]{64}$/);
  assert.equal(h, sessionHash(t));
  assert.notEqual(h, sessionHash(signSession("cid", 5, 30 * DAY, NOW)));
  assert.ok(!h.includes(t.split(".")[0]));
});
