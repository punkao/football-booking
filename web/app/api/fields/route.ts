export const dynamic = "force-dynamic";
import { route } from "@/lib/server/core";
import { fieldsAsOf, loadFields } from "@/lib/server/data";
import { todayOf } from "@/lib/rules";

// FR-30
export const GET = route(async (ctx) => ({ fields: fieldsAsOf(await loadFields(null), todayOf(ctx.now)) }), { expire: false });
