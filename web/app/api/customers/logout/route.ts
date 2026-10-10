export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { CUSTOMER_COOKIE, route } from "@/lib/server/core";

export const POST = route(async () => {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(CUSTOMER_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}, { expire: false });
