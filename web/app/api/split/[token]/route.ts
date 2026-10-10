export const dynamic = "force-dynamic";
import { route } from "@/lib/server/core";
import { splitGet } from "@/lib/server/features";

// FR-19
export const GET = route<{ token: string }>(async (_ctx, p) => splitGet(p.token));
