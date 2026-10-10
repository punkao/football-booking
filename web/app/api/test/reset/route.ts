export const dynamic = "force-dynamic";
import type { NextRequest } from "next/server";
import { testEndpoint } from "@/lib/server/testing";

// NFR-10 (only when ALLOW_TEST_RESET=1)
export async function POST(req: NextRequest) {
  return testEndpoint(req, "reset");
}
