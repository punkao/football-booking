import type { RateStep } from "@/lib/rules";

// v2 (ADR-11): tables and seed data live in db/migrations + db/init/02-seed.sql (one source).
// FALLBACK ONLY: the home page reads the fields (and field_rates) from the database (lib/server/page.ts pageFieldsOrSeed);
// this copy is used only when the database does not answer within 2 seconds, so the page still opens. It is never the source of a price.
// The values are the same as the `fields` rows of db/init/02-seed.sql (TEST-DATA section 3).
// CR-05: rateChanges = the same as the field_rates rows of 02-seed.sql / migration 008 (price by play date) — keep all three equal
// (e2e CR-05-02 compares this card with /api/fields). A price change made only in field_rates is not reflected here — and need not be.

const FROM_NOV_2026 = [{ from: "2026-11-01", dayRate: 800, eveningRate: 1300 }];
export const SEED_FIELDS: { id: string; name: string; size: number; covered: boolean; dayRate: number; eveningRate: number; rateChanges: RateStep[] }[] = [
  { id: "A", name: "สนาม A", size: 5, covered: false, dayRate: 800, eveningRate: 1200, rateChanges: FROM_NOV_2026 },
  { id: "B", name: "สนาม B", size: 5, covered: false, dayRate: 800, eveningRate: 1200, rateChanges: FROM_NOV_2026 },
  { id: "C", name: "สนาม C", size: 7, covered: true, dayRate: 1200, eveningRate: 1800, rateChanges: [] },
];
