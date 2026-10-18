export const dynamic = "force-dynamic";
import { body, route } from "@/lib/server/core";
import { chatBook } from "@/lib/server/chat";

// FR-34 · BR-31 · ADR-17: the customer ticks PDPA consent on the card and confirms
export const POST = route(async (ctx) => chatBook(ctx, await body(ctx.req)));
