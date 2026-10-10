export const dynamic = "force-dynamic";
import { route } from "@/lib/server/core";
import { staffCheckin } from "@/lib/server/features";

// FR-23
export const POST = route<{ code: string }>(async (ctx, p) => staffCheckin(ctx, p.code));
