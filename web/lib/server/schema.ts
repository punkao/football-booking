// v2 (ADR-11): tables and seed data live in db/migrations + db/init/02-seed.sql (one source).
// This file only keeps the static field facts that the home page shows without a database query.
// The values are the same as the `fields` rows of db/init/02-seed.sql (TEST-DATA section 3).

export const SEED_FIELDS = [
  { id: "A", name: "สนาม A", size: 5, covered: false, dayRate: 800, eveningRate: 1200 },
  { id: "B", name: "สนาม B", size: 5, covered: false, dayRate: 800, eveningRate: 1200 },
  { id: "C", name: "สนาม C", size: 7, covered: true, dayRate: 1200, eveningRate: 1800 },
];
