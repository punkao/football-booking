// Review round R1 (one secret, no public fallback) and R9 (draft tokens use the same sign/unsign) — written first.
import { test } from "node:test";
import assert from "node:assert/strict";
import { MIN_SECRET_LENGTH, resolveSessionSecret } from "./secret.ts";

const OLD_PUBLIC_DEFAULT = "luknang-arena-session-secret";

test("R1 SESSION_SECRET: 32+ characters is used as is", () => {
  const s = "x".repeat(32);
  assert.equal(MIN_SECRET_LENGTH, 32);
  assert.deepEqual(resolveSessionSecret({ SESSION_SECRET: s }), { ok: true, secret: s, temporary: false });
});

test("R1 missing / short / the old public value → refuse to start (with how to fix)", () => {
  for (const v of [undefined, "", "x".repeat(31), OLD_PUBLIC_DEFAULT, OLD_PUBLIC_DEFAULT + "-padding-to-be-long-enough"]) {
    const r = resolveSessionSecret({ SESSION_SECRET: v, ALLOW_TEST_RESET: "0" });
    assert.equal(r.ok, false, String(v));
    assert.match((r as { message: string }).message, /SESSION_SECRET/);
    assert.match((r as { message: string }).message, /randomBytes/);
  }
});

test("R1 test machine (ALLOW_TEST_RESET=1) without a secret → random secret for this run + warning", () => {
  const a = resolveSessionSecret({ ALLOW_TEST_RESET: "1" });
  const b = resolveSessionSecret({ ALLOW_TEST_RESET: "1" });
  assert.equal(a.ok, true);
  assert.equal((a as { temporary: boolean }).temporary, true);
  assert.ok((a as { secret: string }).secret.length >= 32);
  assert.notEqual((a as { secret: string }).secret, (b as { secret: string }).secret);
  assert.notEqual((a as { secret: string }).secret, OLD_PUBLIC_DEFAULT);
});

test("R9 draft tokens are signed with the same sign/unsign and can't be swapped with session cookies", async () => {
  process.env.SESSION_SECRET = "t".repeat(40);
  const { sign, signDraft, readDraft, unsign } = await import("./crypto.ts");
  const draft = { sid: "5d7c1e0a-8b3f-4c2e-9a61-0f4b2d8e7c11", a: { fieldId: "B" }, exp: 123 };
  const tok = signDraft(draft);
  assert.deepEqual(readDraft(tok), { kind: "draft", ...draft });
  assert.equal(readDraft(sign({ sid: draft.sid, a: {}, exp: 123 })), null); // a payload without kind "draft"
  assert.equal(readDraft(sign({ sid: 1 })), null); // a staff cookie is not a draft
  assert.equal(readDraft(tok.slice(0, -2) + "xx"), null);
  assert.equal(unsign<{ kind: string }>(tok)?.kind, "draft");
});
