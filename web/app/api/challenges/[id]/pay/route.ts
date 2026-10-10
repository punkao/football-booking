export const dynamic = "force-dynamic";
import { body, route } from "@/lib/server/core";
import { challengePay } from "@/lib/server/features";

// FR-21
export const POST = route<{ id: string }>(async (ctx, p) => challengePay(ctx, Number(p.id), await body(ctx.req)));
