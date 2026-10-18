export const dynamic = "force-dynamic";
import { route } from "@/lib/server/core";
import { stockOverview } from "@/lib/server/stock";

// FR-37 / FR-41 (STAFF, MANAGER, OWNER · warnings only for MANAGER / OWNER, BR-44)
export const GET = route(async (ctx) => stockOverview(ctx));
