export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { STAFF_COOKIE, route } from "@/lib/server/core";

export const POST = route(async () => {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(STAFF_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}, { expire: false });
