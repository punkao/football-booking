export const dynamic = "force-dynamic";
import { body, route } from "@/lib/server/core";
import { seriesPreview } from "@/lib/server/features";

// FR-15, FR-16
export const POST = route(async (ctx) => seriesPreview(ctx, await body(ctx.req)));
