export const dynamic = "force-dynamic";
import { body, route } from "@/lib/server/core";
import { staffReturn } from "@/lib/server/features";

// FR-25
export const POST = route<{ code: string }>(async (ctx, p) => staffReturn(ctx, p.code, await body(ctx.req)));
