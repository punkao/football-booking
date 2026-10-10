export const dynamic = "force-dynamic";
import { route } from "@/lib/server/core";
import { staffNoShow } from "@/lib/server/features";

// FR-24
export const POST = route<{ code: string }>(async (ctx, p) => staffNoShow(ctx, p.code));
