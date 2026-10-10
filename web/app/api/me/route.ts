export const dynamic = "force-dynamic";
import { route } from "@/lib/server/core";
import { me } from "@/lib/server/features";

// FR-09, FR-12, FR-14, FR-18
export const GET = route(async (ctx) => me(ctx));
