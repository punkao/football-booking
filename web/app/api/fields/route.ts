export const dynamic = "force-dynamic";
import { route } from "@/lib/server/core";
import { loadFields } from "@/lib/server/data";

// FR-30
export const GET = route(async () => ({ fields: await loadFields(null) }), { expire: false });
