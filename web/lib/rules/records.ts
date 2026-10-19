// Record-keeping rules (pure, ADR-05): BR-42 history / audit words · BR-43 migration plan · NFR-10 reset clock ·
// NFR-19 database errors · BR-25 cheaper reschedule that keeps every money column >= 0.

/** T-16: the fixed words of AuditLog.action */
export const AUDIT_ACTIONS = [
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
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export function isAuditAction(v: unknown): v is AuditAction {
  return typeof v === "string" && (AUDIT_ACTIONS as readonly string[]).includes(v);
}

/** T-15: BookingStatusHistory.actor is CUSTOMER / BOT / SYSTEM or a staff username */
export const HISTORY_ACTORS = ["CUSTOMER", "BOT", "SYSTEM"] as const;

const ACTOR_LABEL: Record<string, { th: string; en: string }> = {
  CUSTOMER: { th: "ลูกค้า", en: "Customer" },
  BOT: { th: "แชทบอท", en: "Chatbot" },
  SYSTEM: { th: "ระบบ", en: "System" },
};

export function historyActorLabel(actor: string, lang: "th" | "en"): string {
  return ACTOR_LABEL[actor]?.[lang] ?? actor;
}

/** TEST-DATA section 1 / T-18: "today" of the web during tests */
export const DEFAULT_TEST_NOW = "2026-10-09T10:00:00+07:00";

/**
 * NFR-10: the `now` of POST /api/test/reset and /api/test/clock.
 * reset without now → DEFAULT_TEST_NOW (fixed seed dates) · clock without now → null (real time).
 */
export function parseTestNow(v: unknown, kind: "reset" | "clock"): Date | null | "invalid" {
  if (v === undefined || v === null || v === "") return kind === "reset" ? new Date(DEFAULT_TEST_NOW) : null;
  if (typeof v !== "string" && typeof v !== "number") return "invalid";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "invalid" : d;
}

/** NFR-19: errors raised by database constraints that the app reports with its own error code */
export function dbErrorCode(e: unknown): string | null {
  const code = e && typeof e === "object" ? (e as { code?: unknown }).code : undefined;
  if (code === "23P01") return "SLOT_TAKEN"; // exclusion_violation of bookings_no_overlap = BR-06
  return null;
}

export type MigrationFile = { version: string; name: string; up: string; down: string };

/** BR-43 / ADR-11: NNN_name.sql + NNN_name.down.sql, in number order; refuses gaps in the pairing */
export function planMigrations(files: string[]): MigrationFile[] {
  const ups = new Map<string, string>();
  const downs = new Set<string>();
  for (const f of files) {
    const down = /^(\d{3})_([A-Za-z0-9_]+)\.down\.sql$/.exec(f);
    if (down) {
      downs.add(f);
      continue;
    }
    const up = /^(\d{3})_([A-Za-z0-9_]+)\.sql$/.exec(f);
    if (!up) continue;
    if (ups.has(up[1])) throw new Error(`two migrations use number ${up[1]}: ${ups.get(up[1])} and ${f}`);
    ups.set(up[1], f);
  }
  const plan: MigrationFile[] = [];
  for (const [version, up] of [...ups].sort((a, b) => a[0].localeCompare(b[0]))) {
    const name = up.slice(4, -4);
    const down = `${version}_${name}.down.sql`;
    if (!downs.has(down)) throw new Error(`${up} has no ${down}`);
    downs.delete(down);
    plan.push({ version, name, up, down });
  }
  if (downs.size) throw new Error(`down file without its migration: ${[...downs].join(", ")}`);
  return plan;
}

/**
 * BR-25 cheaper reschedule. v1 gave the whole difference back as credit and took it off `amountPaid`, which could
 * go below 0 (NFR-19 forbids it). Same result as v1 whenever the money paid covers the difference; otherwise the
 * difference comes back from what was paid, then from the credit used, and the rest is no longer due at the field.
 */
export function rescheduleSettlement(i: { difference: number; amountPaid: number; creditUsed: number; dueAtField: number }) {
  const diff = Math.max(0, i.difference);
  const fromPaid = Math.min(diff, Math.max(0, i.amountPaid));
  const fromCredit = Math.min(diff - fromPaid, Math.max(0, i.creditUsed));
  const fromDue = Math.min(diff - fromPaid - fromCredit, Math.max(0, i.dueAtField));
  return {
    creditBack: fromPaid + fromCredit,
    amountPaid: i.amountPaid - fromPaid,
    creditUsed: i.creditUsed - fromCredit,
    dueAtField: i.dueAtField - fromDue,
  };
}

/**
 * 07-SAD 8.1 CSRF (R6): a data-changing request that carries an Origin must come from this site.
 * "null" (sandboxed frame, file://, some redirects) is refused · no Origin at all (curl, test scripts) passes.
 */
export function checkOrigin(method: string, origin: string | null, host: string | null): boolean {
  if (method === "GET" || method === "HEAD" || origin === null) return true;
  if (origin === "null") return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
