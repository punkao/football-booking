export const dynamic = "force-dynamic";
import { route } from "@/lib/server/core";
import { staffGet } from "@/lib/server/features";

// FR-23
export const GET = route<{ code: string }>(async (ctx, p) => staffGet(ctx, p.code));
