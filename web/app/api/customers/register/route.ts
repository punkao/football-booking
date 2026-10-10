export const dynamic = "force-dynamic";
import { body, route } from "@/lib/server/core";
import { register } from "@/lib/server/auth";

// FR-13
export const POST = route(async (ctx) => register(ctx, await body(ctx.req)));
