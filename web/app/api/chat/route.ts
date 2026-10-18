export const dynamic = "force-dynamic";
import { body, route } from "@/lib/server/core";
import { chatHistory, chatSend } from "@/lib/server/chat";

// FR-32 – FR-35 · BR-29 – BR-32 · NFR-15 – NFR-17
export const POST = route(async (ctx) => chatSend(ctx, await body(ctx.req)), { expire: true });
export const GET = route(async (ctx) => chatHistory(ctx));
