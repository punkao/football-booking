// Unit tests for the B1 record-keeping rules (node --test). Written before lib/rules/records.ts.
// BR-42 (history / audit) · BR-43 (migrations) · NFR-10 / T-18 (reset clock) · NFR-19 (DB constraints → error codes)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AUDIT_ACTIONS,
  DEFAULT_TEST_NOW,
  dbErrorCode,
  historyActorLabel,
  isAuditAction,
  parseTestNow,
  planMigrations,
  rescheduleSettlement,
} from "./index.ts";

test("T-16 AuditLog.action is a fixed list of 13 words", () => {
  assert.deepEqual(
    [...AUDIT_ACTIONS],
    [
      "CHECKIN",
      "NO_SHOW",
      "RETURN_RENTALS",
      "RAIN_CLOSE",
      "HOLIDAY_ADD",
      "HOLIDAY_REMOVE",
      "STOCK_RECEIVE",
      "STOCK_SALE",
      "STOCK_TRANSFER",
      "STOCK_DAMAGE",
      "STOCK_ADJUST",
      "REORDER_POINT",
      "REPORT_EXPORT",
    ],
  );
  assert.equal(isAuditAction("NO_SHOW"), true);
  assert.equal(isAuditAction("BOOKING_CHECKIN"), false); // 07-SAD example name, not the T-16 word
  assert.equal(isAuditAction("no_show"), false);
  assert.equal(isAuditAction(undefined), false);
});

test("T-15 history actor shown to people: BOT is 'แชทบอท', a staff username stays as is", () => {
  assert.equal(historyActorLabel("BOT", "th"), "แชทบอท");
  assert.equal(historyActorLabel("BOT", "en"), "Chatbot");
  assert.equal(historyActorLabel("CUSTOMER", "th"), "ลูกค้า");
  assert.equal(historyActorLabel("CUSTOMER", "en"), "Customer");
  assert.equal(historyActorLabel("SYSTEM", "th"), "ระบบ");
  assert.equal(historyActorLabel("SYSTEM", "en"), "System");
  assert.equal(historyActorLabel("staff", "th"), "staff"); // username, never the display name (T-15)
});

test("NFR-10 / T-18 reset without now = Fri 9 Oct 2026 10:00 Bangkok", () => {
  assert.equal(DEFAULT_TEST_NOW, "2026-10-09T10:00:00+07:00");
  const d = parseTestNow(undefined, "reset");
  assert.ok(d instanceof Date);
  assert.equal((d as Date).toISOString(), "2026-10-09T03:00:00.000Z");
  assert.equal((parseTestNow("", "reset") as Date).toISOString(), "2026-10-09T03:00:00.000Z");
  assert.equal((parseTestNow(null, "reset") as Date).toISOString(), "2026-10-09T03:00:00.000Z");
  // an explicit now wins
  assert.equal((parseTestNow("2026-10-10T09:59:00+07:00", "reset") as Date).toISOString(), "2026-10-10T02:59:00.000Z");
  // /api/test/clock without now unlocks the clock (real time, v1 behaviour)
  assert.equal(parseTestNow(undefined, "clock"), null);
  assert.equal(parseTestNow("not a date", "reset"), "invalid");
  assert.equal(parseTestNow({}, "clock"), "invalid");
});

test("NFR-19 / BR-06 a database EXCLUDE violation is the same error as the app check", () => {
  assert.equal(dbErrorCode({ code: "23P01" }), "SLOT_TAKEN");
  assert.equal(dbErrorCode({ code: "23505" }), null);
  assert.equal(dbErrorCode(new Error("x")), null);
  assert.equal(dbErrorCode(null), null);
});

test("BR-43 migrations: NNN_name.sql in number order, every one has a .down.sql", () => {
  const files = [
    "002_history_audit.sql",
    "001_v1_baseline.down.sql",
    "001_v1_baseline.sql",
    "002_history_audit.down.sql",
    "README.txt",
    "010_later.sql",
    "010_later.down.sql",
  ];
  const plan = planMigrations(files);
  assert.deepEqual(
    plan.map((m) => [m.version, m.name, m.up, m.down]),
    [
      ["001", "v1_baseline", "001_v1_baseline.sql", "001_v1_baseline.down.sql"],
      ["002", "history_audit", "002_history_audit.sql", "002_history_audit.down.sql"],
      ["010", "later", "010_later.sql", "010_later.down.sql"],
    ],
  );
  // a migration without a way back is refused (BR-43: every migration can be rolled back)
  assert.throws(() => planMigrations(["001_a.sql", "002_b.sql", "002_b.down.sql"]), /001_a\.sql/);
  // two migrations with the same number are refused
  assert.throws(() => planMigrations(["001_a.sql", "001_a.down.sql", "001_b.sql", "001_b.down.sql"]), /001/);
  // a down file without its up file is refused
  assert.throws(() => planMigrations(["003_c.down.sql"]), /003_c/);
});

test("BR-25 + NFR-19 cheaper reschedule: same as v1 when the paid money covers it, never a negative column", () => {
  // v1 case: Wed 17:00 (1,200, paid 600 deposit) → Wed 09:00 (800): 400 back as credit, paid 600 → 200
  assert.deepEqual(rescheduleSettlement({ difference: 400, amountPaid: 600, creditUsed: 0, dueAtField: 600 }), {
    creditBack: 400,
    amountPaid: 200,
    creditUsed: 0,
    dueAtField: 600,
  });
  // exactly the paid amount
  assert.deepEqual(rescheduleSettlement({ difference: 600, amountPaid: 600, creditUsed: 0, dueAtField: 600 }), {
    creditBack: 600,
    amountPaid: 0,
    creditUsed: 0,
    dueAtField: 600,
  });
  // more than paid: Wed 19–21 (2,400, paid 1,200) → Wed 09–11 (1,600 → diff 800) fits; 2,400 → 800 (diff 1,600) does not:
  // 1,200 paid back as credit, the other 400 comes off what is still due at the field (1,200 → 800)
  assert.deepEqual(rescheduleSettlement({ difference: 1600, amountPaid: 1200, creditUsed: 0, dueAtField: 1200 }), {
    creditBack: 1200,
    amountPaid: 0,
    creditUsed: 0,
    dueAtField: 800,
  });
  // paid fully with credit: 1,200 → 800, credit used 1,200 → 800 and 400 credit back
  assert.deepEqual(rescheduleSettlement({ difference: 400, amountPaid: 0, creditUsed: 1200, dueAtField: 0 }), {
    creditBack: 400,
    amountPaid: 0,
    creditUsed: 800,
    dueAtField: 0,
  });
  // nothing cheaper → nothing changes
  assert.deepEqual(rescheduleSettlement({ difference: 0, amountPaid: 600, creditUsed: 100, dueAtField: 500 }), {
    creditBack: 0,
    amountPaid: 600,
    creditUsed: 100,
    dueAtField: 500,
  });
});
