export const dynamic = "force-dynamic";
import type { NextRequest } from "next/server";
import { testEndpoint, testNotFound } from "@/lib/server/testing";

// NFR-10 (only when ALLOW_TEST_RESET=1)
export async function POST(req: NextRequest) {
  return testEndpoint(req, "reset");
}

// NFR-21: any other method → 404
export const GET = testNotFound;
export const PUT = testNotFound;
export const PATCH = testNotFound;
export const DELETE = testNotFound;
