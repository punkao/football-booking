#!/usr/bin/env node
// Review round (docs/08e-FIX-PROMPT-review.md) through the HTTP API: R2 R4 R6 R11 (+ R10 when MODE=ai).
//   node selfcheck/review-check.mjs          (BASE_URL defaults to http://localhost:3000 · needs ALLOW_TEST_RESET=1)
const BASE = process.env.BASE_URL || "http://localhost:3000";
const results = [];
function check(id, desc, ok, detail = "") {
  results.push(!!ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${id.padEnd(5)} ${desc}${ok ? "" : `  -> ${String(detail).slice(0, 200)}`}`);
}
class Client {
  constructor(ip) {
    this.jar = new Map();
    this.ip = ip;
  }
  async call(method, p, body, extra = {}) {
    const headers = { "content-type": "application/json", ...extra };
    if (this.ip) headers["x-forwarded-for"] = this.ip;
    if (this.jar.size) headers.cookie = [...this.jar].map(([k, v]) => `${k}=${v}`).join("; ");
    const res = await fetch(BASE + p, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [kv] = c.split(";");
      const i = kv.indexOf("=");
      this.jar.set(kv.slice(0, i), kv.slice(i + 1));
    }
    let json = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }
    return { status: res.status, json };
  }
}
const code = (r) => r.json?.error?.code;
const sys = new Client();
const reset = () => sys.call("POST", "/api/test/reset", {});
async function staff(u, p) {
  const c = new Client();
  await c.call("POST", "/api/staff/login", { username: u, password: p });
  return c;
}

async function main() {
  // ---- R2: per-IP limits, room row only after the checks ----
  await reset();
  const owner = await staff("owner", "Owner1234");
  const rooms = async () => (await owner.call("GET", "/api/owner/chats")).json?.chats?.length ?? -1;
  const before = await rooms();
  const st = [];
  for (let i = 0; i < 11; i++) st.push((await new Client("198.51.100.7").call("POST", "/api/chat", { text: "สวัสดี" })).status);
  const after = await rooms();
  check("R2a", "10 new rooms per hour from one IP ok, the 11th → 429 and no room row", st.slice(0, 10).every((s) => s === 200) && st[10] === 429 && after === before + 10, `${st.join(",")} rooms ${before}→${after}`);
  const a = new Client("198.51.100.8");
  const b = new Client("198.51.100.8");
  const ms = [];
  for (let i = 0; i < 21; i++) ms.push((await (i % 2 ? b : a).call("POST", "/api/chat", { text: "เปิดกี่โมง" })).status);
  check("R2b", "20 messages per minute per IP across rooms ok, the 21st → 429 CHAT_RATE_LIMIT", ms.slice(0, 20).every((s) => s === 200) && ms[20] === 429, ms.join(","));

  // ---- R4: rentals reserved by bookings that have not ended ----
  await reset();
  const cust = new Client();
  const bk = await cust.call("POST", "/api/bookings", { fieldId: "A", date: "2026-10-14", startHour: 19, hours: 1, name: "จองเอี๊ยม", phone: "0890001111", consent: true, rentals: { BIB: 6 } });
  const mg = await staff("manager", "Manager1234");
  const dmg = await mg.call("POST", "/api/manager/stock/damage", { itemId: "BIB", locationId: "COUNTER", qty: 1, reason: "ขาด" });
  const adj = await mg.call("POST", "/api/manager/stock/adjust", { itemId: "BIB", locationId: "COUNTER", countedQty: 5, reason: "นับได้ 5" });
  const tr = await mg.call("POST", "/api/staff/stock/transfer", { itemId: "BIB", qty: 6, fromLocationId: "COUNTER", toLocationId: "STORE" });
  const ok = await mg.call("POST", "/api/manager/stock/damage", { itemId: "BALL", locationId: "COUNTER", qty: 1, reason: "รั่ว" });
  check(
    "R4",
    "6 bibs booked → damage / adjust below 6 refused STOCK_RESERVED (6) · moving between places ok · other items ok",
    bk.status === 201 && code(dmg) === "STOCK_RESERVED" && dmg.json?.error?.params?.reserved === 6 && code(adj) === "STOCK_RESERVED" && tr.status === 200 && ok.status === 200,
    `${bk.status} ${code(dmg)} ${code(adj)} ${tr.status} ${ok.status}`,
  );

  // ---- R6: Origin null ----
  const nul = await new Client().call("POST", "/api/quote", { fieldId: "A", date: "2026-10-14", startHour: 9, hours: 1 }, { origin: "null" });
  const none = await new Client().call("POST", "/api/quote", { fieldId: "A", date: "2026-10-14", startHour: 9, hours: 1 });
  check("R6", "POST with Origin: null → 403 FORBIDDEN_ORIGIN · without Origin → 200", nul.status === 403 && code(nul) === "FORBIDDEN_ORIGIN" && none.status === 200, `${nul.status} ${none.status}`);

  // ---- R11: back office uses a separate reference, never the customer's room id ----
  await reset();
  const c = new Client("198.51.100.9");
  const sent = await c.call("POST", "/api/chat", { text: "เบอร์ผม 0891112222 ครับ" });
  const sid = sent.json?.sessionId;
  const list = (await owner.call("GET", "/api/owner/chats")).json?.chats ?? [];
  const row = list.find((x) => x.messages >= 2 && x.firstText.includes("xxx"));
  const leak = JSON.stringify(list).includes(sid);
  const detail = row ? await owner.call("GET", `/api/owner/chats/${row.ref ?? row.id}`) : { status: 0 };
  const byUuid = await owner.call("GET", `/api/owner/chats/${sid}`);
  const thief = new Client();
  thief.jar.set("ln_chat", row?.ref ?? row?.id ?? "x");
  const stolen = await thief.call("GET", "/api/chat");
  const stolen2 = await thief.call("GET", `/api/chat/${row?.ref ?? row?.id}`);
  check(
    "R11",
    "owner list has no room id (only ref) · detail by ref ok, by room id 404 · ref used as a cookie / customer URL gives nothing",
    !!sid && !!row && !leak && !!row.ref && detail.status === 200 && byUuid.status === 404 && (stolen.json?.messages?.length ?? 0) === 0 && stolen2.status === 404,
    `leak=${leak} ref=${row?.ref} detail=${detail.status} uuid=${byUuid.status} stolen=${stolen.json?.messages?.length} ${stolen2.status}`,
  );

  // ---- R10: MODE=ai without the right key → apology, not a normal answer (only checked when MODE=ai) ----
  const v = (await sys.call("GET", "/api/version")).json;
  if (v?.chatMode === "ai") {
    const r = await new Client("198.51.100.10").call("POST", "/api/chat", { text: "เปิดกี่โมง" });
    console.log(`info  R10   MODE=ai reply failed=${r.json?.failed} (expect true when the web has no / a wrong LLM_API_KEY)`);
  }

  await reset();
  const fail = results.filter((x) => !x).length;
  console.log(`\nreview-check: ผ่าน ${results.length - fail} / ${results.length}`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => {
  console.error(e);
  process.exit(2);
});
