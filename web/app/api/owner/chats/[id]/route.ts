export const dynamic = "force-dynamic";
import { route } from "@/lib/server/core";
import { chatDetail } from "@/lib/server/backoffice";
import { testNotFound } from "@/lib/server/testing";

// FR-36 · BR-44 / BR-45 — read only
export const GET = route<{ id: string }>(async (ctx, p) => chatDetail(ctx, p.id));
export const POST = testNotFound;
export const PUT = testNotFound;
export const PATCH = testNotFound;
export const DELETE = testNotFound;
