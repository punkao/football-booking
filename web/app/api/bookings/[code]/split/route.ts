export const dynamic = "force-dynamic";
import { body, route } from "@/lib/server/core";
import { splitCreate } from "@/lib/server/features";

// FR-19
export const POST = route<{ code: string }>(async (ctx, p) => splitCreate(ctx, p.code, await body(ctx.req)));
