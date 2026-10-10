export const dynamic = "force-dynamic";
import { body, route } from "@/lib/server/core";
import { customerLogin } from "@/lib/server/auth";

// FR-13
export const POST = route(async (ctx) => customerLogin(ctx, await body(ctx.req)));
