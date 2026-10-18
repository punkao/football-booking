export const dynamic = "force-dynamic";
import { route } from "@/lib/server/core";
import { chatHistory } from "@/lib/server/chat";

// FR-35: messages of the room — only for the browser that owns the room (cookie)
export const GET = route<{ sessionId: string }>(async (ctx, p) => chatHistory(ctx, p.sessionId));
