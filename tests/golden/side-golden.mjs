#!/usr/bin/env node
// Golden master ชุดเล็ก: GET /api/availability + รายงานเจ้าของ (JSON + CSV)
//   node tests/golden/side-golden.mjs [--update]      (BASE_URL ค่าเริ่ม http://localhost:3000)
//
// ก่อนยิง reset {} · owner เข้าสู่ระบบผ่าน API ด้วยค่าทดสอบจาก e2e/tests/constants.ts · ยิงเสร็จ reset อีกครั้ง
// (GET reports.csv เขียน audit REPORT_EXPORT 1 แถวต่อครั้ง → reset ท้ายสคริปต์ล้างให้)
//
// การทำให้นิ่ง (normalize):
//   - เก็บ status + content-type + body · ตัด header อื่นทั้งหมด (date · set-cookie · content-disposition ยกเว้นชื่อไฟล์) เพราะเปลี่ยนตามเวลาจริง/cookie
//   - availability: เก็บทุกฟิลด์ รวม `now` `today` `maxDate` เพราะมาจากนาฬิกาที่ reset ล็อกไว้ (app_settings.clock) ไม่ใช่นาฬิกาเครื่อง
//     — รัน 2 รอบติดได้ค่าเดียวกัน ถ้าวันหนึ่งไม่นิ่ง แปลว่า seam นาฬิกาเสีย (เป็นสิ่งที่อยากให้ golden จับ)
//   - CSV: เก็บเป็นรายการบรรทัด (ตัด CRLF เป็นบรรทัด) + ธง bom (3 ไบต์แรก EF BB BF) แทนข้อความดิบ เพื่อให้ diff อ่านได้
import { call, login, reset, seedCredential, writeOrCompare } from "./lib.mjs";

async function main() {
  await reset();
  const owner = seedCredential("owner");
  const cookie = await login("/api/staff/login", { username: owner.username, password: owner.password });
  const cases = [];

  for (const d of ["2026-10-09", "2026-10-12", "2026-10-13", "2026-10-16", "2026-10-17", "2026-10-23", "2026-10-24"]) {
    const r = await call("GET", `/api/availability?date=${d}`);
    cases.push({ id: `availability/${d}`, status: r.status, contentType: r.contentType, body: r.body });
  }

  const RANGES = [
    ["2026-10-03", "2026-10-09"], // TEST-DATA 5.4 (ช่วงที่ seed มีเงิน)
    ["2026-10-08", "2026-10-08"], // E144
    ["2026-10-01", "2026-12-31"], // E140 ขอบ 3 เดือน
    ["2026-10-01", "2027-01-01"], // E141 เกิน
    ["2026-11-30", "2027-02-28"], // A-46 (ระบบเดิมปฏิเสธ · CR-02 ข้อ 4 จะเปลี่ยน → ต้องจด ORACLE-CHANGES)
    ["2026-10-10", "2026-10-09"], // E142 กลับด้าน
  ];
  for (const [f, t] of RANGES) {
    const r = await call("GET", `/api/owner/reports?from=${f}&to=${t}`, { cookie });
    cases.push({ id: `report/${f}..${t}`, status: r.status, contentType: r.contentType, body: r.body });
  }
  for (const [f, t] of RANGES.slice(0, 2)) {
    const r = await call("GET", `/api/owner/reports.csv?from=${f}&to=${t}`, { cookie, text: true });
    const raw = typeof r.body === "string" ? r.body : "";
    const bom = raw.charCodeAt(0) === 0xfeff;
    cases.push({
      id: `csv/${f}..${t}`,
      status: r.status,
      contentType: r.contentType,
      body: { bom, crlf: raw.includes("\r\n"), lines: (bom ? raw.slice(1) : raw).split(/\r?\n/) },
    });
  }
  await reset();

  const doc = {
    meta: {
      endpoint: "GET /api/availability · GET /api/owner/reports · GET /api/owner/reports.csv",
      label: "[E] ล็อกพฤติกรรมของระบบที่รับมอบ (v2-handover) ไม่ใช่ค่าที่ถูกตามร้าน",
      resetBody: {},
      count: cases.length,
    },
    cases,
  };
  process.exit(writeOrCompare("side", doc));
}

main().catch((e) => {
  console.error(`[golden] ล้มก่อนเทียบ: ${e.message}`);
  process.exit(2);
});
