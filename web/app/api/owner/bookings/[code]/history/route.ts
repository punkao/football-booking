export const dynamic = "force-dynamic";
import { route } from "@/lib/server/core";
import { bookingHistory } from "@/lib/server/backoffice";
import { testNotFound } from "@/lib/server/testing";

// FR-43 · BR-42 / BR-44 — read only: no way to change or delete the history (E147 → 404)
export const GET = route<{ code: string }>(async (ctx, p) => bookingHistory(ctx, p.code));
export const POST = testNotFound;
export const PUT = testNotFound;
export const PATCH = testNotFound;
export const DELETE = testNotFound;
