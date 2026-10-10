export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { body, route } from "@/lib/server/core";
import { seriesCreate } from "@/lib/server/features";
import { withAccess } from "@/lib/server/access";
import { msg } from "@/lib/i18n";

// FR-15, FR-16
export const POST = route(async (ctx) => {
  const out = await seriesCreate(ctx, await body(ctx.req));
  return withAccess(NextResponse.json({ ...out, message: msg(ctx.lang, out.messageCode) }, { status: 201 }), ctx, out.codes);
});
