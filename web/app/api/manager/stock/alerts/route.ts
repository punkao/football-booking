export const dynamic = "force-dynamic";
import { route } from "@/lib/server/core";
import { stockAlerts } from "@/lib/server/stock";

// FR-41 · BR-35 / BR-44 (MANAGER, OWNER)
export const GET = route(async (ctx) => stockAlerts(ctx));
