export const dynamic = "force-dynamic";
import { body, route } from "@/lib/server/core";
import { staffLogin } from "@/lib/server/auth";

// FR-31
export const POST = route(async (ctx) => staffLogin(ctx, await body(ctx.req)), { expire: false });
