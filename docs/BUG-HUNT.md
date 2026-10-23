# BUG-HUNT — บั๊กปริศนา (LAB 12 · รอบ B-4 · 2026-10-20)

ทำตาม `docs/09c-TEST-PROMPT-v2.md` ส่วน B → B2 ขั้น 1–6 · เว็บ `http://localhost:3000` · `MODE=mock` ตลอดทั้งรอบ
ผลที่คาดหวังทุกข้อมาจากแผนเดิม (`docs/09-TEST-PLAN.md` / `docs/TEST-CASES.md` / `e2e/plan-cases.json`) **ไม่ได้แก้ test หรือผลที่คาดหวังข้อใดเลย** และไม่ได้ใช้ `--expect-bugs`
ส่วนที่ 1 และส่วนที่ 2 เขียนก่อนเปิด `web/BUGS.md` · เปิด BUGS.md เฉพาะตอนส่วนที่ 3 และอ่านเฉพาะตาราง v2 (3 ตัว) · ไม่ได้เปิด `bugmode1/` หรือ `TEST-REPORT-BUGMODE1.md`

## 0. ขั้นตอนที่ทำ + หลักฐาน

| ขั้น | ทำอะไร | ผล / ไฟล์ |
|---|---|---|
| 1 | เก็บผลโหมดปกติ (B-3) ไว้ที่ `e2e/normal-mode/` | `index.html` · `triage.json` · `plan-cases.json` · `TEST-REPORT.md` · `CHATBOT-REPORT.md` · `results.json` · `run-info.json` (ไม่คัดลอก `gifs/` `videos/` `html/` เพื่อลดขนาด repo) — ดูหมายเหตุลิงก์ในข้อ 0.1 |
| 2 | `BUG_MODE=1 docker compose -f web/compose.yaml up -d` (Git Bash) | `<html … data-bug-mode="1">` · `/api/version` = `{"schemaVersion":"006","chatMode":"mock","bugMode":1}` · `/api/health` = `{"ok":true,"db":true}` |
| 2 | `cd e2e && RUN_MIGRATION_TEST=1 node run-all.mjs` | รอบหลัก 248 ผ่าน / 33 ล้ม / 3 ข้าม (8.6 นาที) · perf 3/3 ผ่าน → `e2e/test-report/bugmode2/` (`results.json` · `run-info.json` bugModeFromHtml "1" · `TEST-REPORT.md` · `CHATBOT-REPORT.md` · `run.log` · `chat/`) |
| 2 | `node build-index.mjs --run test-report/bugmode2 --out test-report/bugmode2/index.html --compare normal-mode --media test-report/bugmode2 --triage test-report/bugmode2/triage.json --label …` | [`e2e/test-report/bugmode2/index.html`](../e2e/test-report/bugmode2/index.html) · เทียบโหมดปกติ: เปลี่ยน 11 จุด (TC × เบราว์เซอร์) |
| 2 | `RUN_MIGRATION_TEST=1 npm run test:gif` (โหมดบั๊ก · chromium + serial · slowMo 650) | 109 ผ่าน / 18 ล้ม / 1 ข้าม · perf-chromium ผ่าน · ข้อที่ล้ม = ชุดเดียวกับรอบหลัก (10 ข้อเดิม + 8 ข้อใหม่) · เก็บ **เฉพาะ GIF/MP4 ของ 8 TC ที่ล้มใหม่** = GIF 11 / MP4 11 ไฟล์ ที่ `bugmode2/gifs` `bugmode2/videos` (TC-DASH-02 มี 4 คลิป) · `TEST-REPORT-gif.md` · `gif-run.log` |
| 2 | คืนหลักฐานโหมดปกติ | `git checkout -- e2e/test-report/gifs e2e/test-report/videos e2e/test-report/chat e2e/test-report/TEST-REPORT.md e2e/test-report/results.json e2e/test-report/run-info.json e2e/plan-cases.json` → ลิงก์ GIF/MP4 ของ `e2e/index.html` กลับเป็นหลักฐานโหมดปกติ 138/138 |
| 4 | ลองซ้ำด้วย Playwright MCP (bridge headless) เฉพาะส่วนที่ล้มใหม่ | 79 การเรียก MCP (trace.jsonl บรรทัด 4518–4596) · ภาพ `docs/evidence/screenshots/mcp/bug-hunt/*.png` |
| 6 | `BUG_MODE=0 docker compose -f web/compose.yaml up -d` + reset `{}` | `data-bug-mode="0"` · `/api/version` = `{"schemaVersion":"006","chatMode":"mock","bugMode":0}` · reset ตอบ `{"ok":true,…,"bugMode":0}` · health `{"ok":true,"db":true}` |

### 0.1 หมายเหตุ `e2e/normal-mode/index.html`
- หน้าเปิดได้ (ข้อมูลฝังในหน้า) · ลิงก์ในสำเนาปรับเป็น path สัมพัทธ์จากโฟลเดอร์ใหม่แล้ว: GIF/MP4 → `../test-report/gifs|videos/` (หลักฐานโหมดปกติที่คืนด้วย git checkout) · แผน/TEST-CASES/TEST-RUN-MCP → `../../docs/` · รายงาน → สำเนาในโฟลเดอร์เดียวกัน
- ลิงก์ที่**อาจเสีย**: ปุ่ม "HTML report" ชี้ `../test-report/html/index.html` ซึ่งไม่อยู่ใน git และถูกรอบโหมดบั๊กเขียนทับแล้ว (ตอนนี้เป็น HTML report ของรอบ GIF โหมดบั๊ก) · ถ้าย้าย/ลบ `test-report/gifs` ภายหลัง ลิงก์ GIF ในสำเนาจะเสีย (ไม่ได้คัดลอกไฟล์วิดีโอ)
- `normal-mode/run-info.json` เป็นของรอบ GIF โหมดปกติ (`gifMode: true`) เพราะคัดลอกจาก `test-report/` ตามคำสั่ง · ผลที่ใช้ตัดสินอยู่ใน `results.json` (`runs` = `npm test` รอบ 2 ของ B-3 · `gifRuns` = รอบ GIF)

### 0.2 สิ่งที่แก้ใน `e2e/` รอบนี้ (เครื่องมือรายงานเท่านั้น ไม่แตะ test)
- `build-index.mjs`: เพิ่ม `--media <โฟลเดอร์>` (อ่าน `gifs/` `videos/` จากโฟลเดอร์นั้นแทน `test-report/`) และ `--triage <ไฟล์>` (ค่าเริ่มต้นยังเป็น `e2e/triage.json`) · `index.template.html`: บรรทัด "จำแนกจาก …" แสดงชื่อไฟล์ triage ที่ใช้จริง — ค่าเริ่มต้นเหมือนเดิม หน้า `e2e/index.html` ไม่เปลี่ยน
- `e2e/test-report/bugmode2/triage.json` = triage ของโหมดปกติ + 8 ข้อที่ล้มใหม่ + TC-MEMBER-06 (flaky) · `e2e/triage.json` ไม่ได้แก้

## 1. ผลตามเกณฑ์ Exit (แผน 6.4 · ตัดสินแยกทีละเบราว์เซอร์ · ต้อง P1 74/74 และผ่าน ≥ 122/128)

| รอบ | เบราว์เซอร์ | P1 ผ่าน | ผ่านรวม | ผ่านเกณฑ์ไหม |
|---|---|---|---|---|
| โหมดปกติ รอบ 1 (B-3) | chromium / firefox / webkit | 72 / 71 / 72 จาก 74 | 117 / 116 / 117 จาก 128 | ❌ ทั้ง 3 |
| โหมดปกติ รอบ 2 (B-3 · = `normal-mode/`) | chromium / firefox / webkit | 72 / 72 / 72 | 117 / 117 / 117 | ❌ ทั้ง 3 |
| **โหมดบั๊ก (B-4 · = `bugmode2/`)** | chromium / firefox / webkit | **66 / 65 / 66** | **109 / 108 / 109** (85.2% / 84.4% / 85.2%) | ❌ ทั้ง 3 |

- ต่างจากโหมดปกติ 8 TC ทุกเบราว์เซอร์ (P1 6 ข้อ: BOOK-04, BOOK-10, SALE-01, DASH-01, DASH-02, REPORT-02 · P2 2 ข้อ: STOCK-03, REPORT-03) + Firefox มี TC-MEMBER-06 (P1) flaky อาการเดิม
- โหมดปกติไม่ผ่านอยู่แล้ว (11 ข้อเดิม) แต่โหมดบั๊กทำให้ "ผ่านรวม" ลด 8 และ P1 ลด 6 — แผนแยก 2 โหมดออกได้ชัด

## 2. ส่วนที่ 1 — ข้อที่ล้ม แยก "ล้มใหม่" กับ "ล้มเหมือนโหมดปกติ"

### 2.1 ล้มเหมือนโหมดปกติ (11 ข้อ · จำแนกเดิมใน `e2e/triage.json`)

| TC | ระดับ | จำแนก | ในโหมดบั๊ก |
|---|---|---|---|
| TC-ROLE-03 | P1 | เว็บผิด (session ไม่ถูกยกเลิกหลัง logout) | ล้มเหมือนเดิม ข้อความ error เดิม |
| TC-SERIES-04 | P1 | ไม่ได้รัน (ข้าม · นับไม่ผ่าน) | ข้ามเหมือนเดิม |
| TC-BOOK-11 | P3 | เว็บผิด | เหมือนเดิม |
| TC-STAFF-06 | P2 | เว็บผิด | เหมือนเดิม |
| TC-CHAT-14 / 15 / 16 | P2 | เว็บผิด (บอทลืมบริบท FR-35) | เหมือนเดิม |
| TC-REPORT-01 | P2 | เว็บผิด (ช่วงเกิน 3 เดือน A-46) | เหมือนเดิม |
| TC-REPORT-04 | P2 | เว็บผิด (ไม่มีคอลัมน์ "เก็บหน้าสนาม") | ล้มที่ assert เดิมก่อน แต่ **ข้อความในตารางที่พิมพ์ออกมาเปลี่ยน**: 9 ต.ค. ขายเงินสด ฿40 → ฿0 · รวม ฿7,300 → ฿7,260 = บั๊ก B โผล่ใน TC นี้ด้วย แต่ถูก "บัง" เพราะ TC ล้มอยู่แล้ว |
| TC-TRACK-01 | P3 | เว็บผิด | เหมือนเดิม |
| TC-DATA-01 | P2 | เว็บผิด | เหมือนเดิม |

flaky: TC-MEMBER-06 Firefox `page.reload: NS_BINDING_ABORTED` (ไม่มี expect ล้ม · เหมือน B-3 รอบ 1) → ไม่นับเป็นบั๊กที่ฝัง

### 2.2 ล้มใหม่ในโหมดบั๊ก (8 TC → จัดกลุ่มได้ 3 บั๊ก)

ตั้งชื่อบั๊กเองจากอาการ (ก่อนเปิด BUGS.md) · GIF/MP4 = รอบ `test:gif` โหมดบั๊ก

| BUG | TC | ระดับ | ขั้นตอนทำซ้ำ | ผลที่คาดหวัง (ที่มา) | ผลจริง (โหมดบั๊ก) | GIF | MP4 |
|---|---|---|---|---|---|---|---|
| **A** จองล่วงหน้าได้ 15 วัน | TC-BOOK-04 | P1 | reset · เปิด `/book` ดูปุ่มวัน → `/book?date=2026-10-24` → ฟอร์ม A 24 ต.ค. 09:00 กรอกชื่อ/เบอร์/PDPA กดยืนยัน | ปุ่มวันถึง 23 ต.ค. ไม่มี 24 ต.ค. · 24 ต.ค. ทุกช่อง `out-of-range` · ฟอร์ม → "จองล่วงหน้าได้ไม่เกิน 14 วัน" ([D] BR-04 · E12–E14: 9 + 14 = 23 ได้ · 9 + 15 = 24 ไม่ได้) | มี `date-chip-2026-10-24` (ล้มทุกเบราว์เซอร์) · MCP: ปุ่มวัน 16 ปุ่ม 9–24 ต.ค. · 24 ต.ค. ช่อง `free` · จองได้ → `/pay/LN-100001` | [GIF](../e2e/test-report/bugmode2/gifs/TC-BOOK-04.gif) | [MP4](../e2e/test-report/bugmode2/videos/TC-BOOK-04.mp4) |
| A | TC-BOOK-10 | P1 | reset · ยิงตาม E04–E21 (ฟอร์ม/API) แถว E14 = จอง 24 ต.ค. 09:00 | E14 `TOO_FAR_AHEAD` ([D] TEST-DATA E14) | ไม่ได้ error (สร้างได้) · E12/E13 ยังถูก · API ตอบ `TOO_FAR_AHEAD` ที่ 25 ต.ค. พร้อม `params.maxDate: "2026-10-24"` | [GIF](../e2e/test-report/bugmode2/gifs/TC-BOOK-10.gif) | [MP4](../e2e/test-report/bugmode2/videos/TC-BOOK-10.mp4) |
| **B** ยอดขายหน้าเคาน์เตอร์ของ "วันสุดท้ายของช่วง" หาย | TC-DASH-01 | P1 | reset · owner เปิด `/owner/dashboard` | today 40 (sales 40 · booking 0 · credit 0) · week 7,300 · แท่ง 9 ต.ค. 40 ([D] TEST-DATA 5.4 + [E sql:money_by_day]) | today 0 · sales 0 · week 7,260 · แท่ง 9 ต.ค. 0 · **แท่ง 8 ต.ค. 4,860 ถูก** | [GIF](../e2e/test-report/bugmode2/gifs/TC-DASH-01.gif) | [MP4](../e2e/test-report/bugmode2/videos/TC-DASH-01.mp4) |
| B | TC-DASH-02 | P1 | reset · จอง+จ่ายมัดจำ ฿400 × 2 (ใช้เครดิต 1,200 อันหนึ่ง) · staff ขายน้ำ 2 เงินสด ฿20 · owner แดชบอร์ด → รีโหลด | booking-money 800 · sales 60 · total 860 · credit 1,200 แยก · week 8,120 ทั้งทันทีและหลังรีโหลด ([D] BR-40, A-37) | booking-money 800 ✅ credit 1,200 ✅ · sales **0** · total **800** · week **8,060** (ทั้ง 2 จังหวะ) | [GIF](../e2e/test-report/bugmode2/gifs/TC-DASH-02.gif) · [2](../e2e/test-report/bugmode2/gifs/TC-DASH-02-2.gif) · [3](../e2e/test-report/bugmode2/gifs/TC-DASH-02-3.gif) · [4](../e2e/test-report/bugmode2/gifs/TC-DASH-02-4.gif) | [MP4](../e2e/test-report/bugmode2/videos/TC-DASH-02.mp4) · [2](../e2e/test-report/bugmode2/videos/TC-DASH-02-2.mp4) · [3](../e2e/test-report/bugmode2/videos/TC-DASH-02-3.mp4) · [4](../e2e/test-report/bugmode2/videos/TC-DASH-02-4.mp4) |
| B | TC-SALE-01 | P1 | reset · staff ขายน้ำ 2 + เกลือแร่ 1 พร้อมเพย์ → owner แดชบอร์ด | ขาย ฿40 · COUNTER น้ำ 22 เกลือแร่ 11 · dash-today-sales 80 (= 40 seed + 40) ([D] E135, US-42) | ขาย ฿40 และคลังถูก · dash-today-sales **0** · รวมวันนี้ **0** | [GIF](../e2e/test-report/bugmode2/gifs/TC-SALE-01.gif) | [MP4](../e2e/test-report/bugmode2/videos/TC-SALE-01.mp4) |
| B | TC-REPORT-02 | P1 | reset · owner `/owner/reports` 2026-10-08 → 2026-10-08 | promptpay 60 · total 4,860 ([D] E144, 5.4 + [E sql]) | promptpay **0** · total **4,800** | [GIF](../e2e/test-report/bugmode2/gifs/TC-REPORT-02.gif) | [MP4](../e2e/test-report/bugmode2/videos/TC-REPORT-02.mp4) |
| B | TC-REPORT-03 | P2 | reset · owner รายงาน 3–9 ต.ค. กด CSV | แถว "รวม" รวมรับเงิน 7300 ([D] NFR-22 + 5.4) | **7260** (BOM / หัวไทย / ไม่มี ฿ / REPORT_EXPORT ถูก) | [GIF](../e2e/test-report/bugmode2/gifs/TC-REPORT-03.gif) | [MP4](../e2e/test-report/bugmode2/videos/TC-REPORT-03.mp4) |
| **C** เตือนของใกล้หมดตอนยอดรวม = จุดสั่งซื้อซ้ำ | TC-STOCK-03 | P2 | reset · manager ชำรุดน้ำ STORE 72 (รวมเหลือ 48) → `/staff/stock` | 48 → `stock-alerts` 0 ไม่เตือน ([D] BR-35 "ต่ำกว่า" · E129) · 49 → 0 · 47 → 1 | 48 → `data-count` **1** "เหลือรวม 48 (จุดสั่งซื้อซ้ำ 48)" + ป้าย "ใกล้หมด" · 49 → 0 ✅ · 47 → 1 ✅ | [GIF](../e2e/test-report/bugmode2/gifs/TC-STOCK-03.gif) | [MP4](../e2e/test-report/bugmode2/videos/TC-STOCK-03.mp4) |

### 2.3 เทียบกับแผนหัวข้อ 8.1 ("ถ้าเว็บพังแบบนี้ → TC ไหนต้องล้ม")

| BUG | แถวที่ใกล้ที่สุดใน 8.1 | ทายไว้ตรงไหม |
|---|---|---|
| A (BR-04 ขอบ 14 วัน) | #7 "24 ชม. พอดี / 15 นาทีพอดี ใช้ `>` แทน `≥`" (หมวดเวลา) | **ไม่ได้ทายแบบนี้ไว้** — 8.1 ไม่มีแถว 14 วัน · แต่ TC-BOOK-04 / BOOK-10 เป็น Boundary คู่ E12–E14 จาก TEST-DATA จึงจับได้เองโดยไม่ต้องทาย · ควรเพิ่มแถว "ขอบ 14 วันเลื่อน ±1 → TC-BOOK-04, BOOK-10 (E13/E14)" |
| B (BR-40 ขายวันสุดท้ายของช่วงหาย) | #3 "เครดิตถูกนับเป็นรายได้ → DASH-02, REPORT-05" · #14 "รายงานนับตามวันจ่ายแทนวันเตะ → REPORT-02, REPORT-05" | **ทายบริเวณถูก (BR-40 · แดชบอร์ด/รายงาน) แต่ไม่ได้ทายรูปแบบนี้** — TC ที่ทายไว้ DASH-02, REPORT-02 ล้มจริง · REPORT-05 ที่ทายไว้ **ไม่ล้ม** (ตรวจเฉพาะเงินจอง/จำนวนการจอง ไม่มีขาย) · ที่ล้มเพิ่มนอกคำทาย: DASH-01, SALE-01, REPORT-03 |
| C (BR-35 `≤` แทน `<`) | #10 "ขายเกิน/ย้ายเกิน → SALE-02, STOCK-02" (หมวดคลัง) · #7 (แนวคิด `>`/`≥` เดียวกัน) | **ไม่ได้ทายไว้** ในหมวดคลัง · จับได้จากค่าขอบ E128–E130 ใน TC-STOCK-03 · DASH-01 ตรวจ `dash-low-stock 0` จาก seed ซึ่งไม่มีของเท่าจุดพอดี จึงไม่ช่วย |

สรุป: 8.1 ทาย "บริเวณ" ถูก 1/3 (B) ที่เหลือจับได้เพราะเทคนิค Boundary + ข้อมูล TEST-DATA ครบทุกแถว (ไม่ใช่เพราะทายไว้) → บทเรียน: ตาราง 8.1 ควรมีแถวขอบ `<`/`≤` ของทุกกฎตัวเลข ไม่ใช่เฉพาะกฎเวลา

## 3. ส่วนที่ 2 — ลองซ้ำด้วย MCP (ยังไม่เปิด BUGS.md)

Playwright MCP ผ่าน bridge (`tools/mcp-bridge.mjs --headless` + `tools/mcp-client.mjs call …` ใช้ `target` = selector `[data-testid=…]`) · reset `{}` ก่อนแต่ละกลุ่มและตอนจบ · 79 การเรียก

| กลุ่ม | ที่ทำผ่าน MCP (คลิก/กรอกแบบคน) | ผลที่อ่านจากหน้าจอ | ภาพ |
|---|---|---|---|
| A | `/book` อ่านปุ่มวัน · `/book?date=` 23 / 24 / 25 ต.ค. · ฟอร์ม `/book/new?field=A&date=2026-10-24&start=9` พิมพ์ชื่อ/เบอร์ ติ๊ก PDPA กดยืนยัน · curl API 25 ต.ค. | ปุ่มวัน 9–24 ต.ค. (16 ปุ่ม) · 23 และ 24 ต.ค. `slot-A-9`/`slot-C-23` = `free` · 25 ต.ค. = `out-of-range` · กดยืนยัน 24 ต.ค. → `/pay/LN-100001` "ยอดที่ต้องจ่ายตอนนี้ ฿600" · API 25 ต.ค. → `TOO_FAR_AHEAD` `maxDate: "2026-10-24"` → **ขอบเลื่อนจาก 23 เป็น 24 พอดี 1 วัน** | `docs/evidence/screenshots/mcp/bug-hunt/BUG-A-pay-24oct.png` |
| B | owner เข้าสู่ระบบผ่าน `/staff/login` → `/owner/dashboard` · `/owner/reports` กรอกช่วง 8–8, 8–9, 9–10, 3–9 ต.ค. กดดูรายงาน | แดชบอร์ด: today 0 · sales 0 · week 7,260 · แท่ง 8 ต.ค. 4,860 (มีขาย ฿60) · แท่ง 9 ต.ค. 0 · รายงาน 8–8: promptpay 0 รวม 4,800 · 8–9: **8 ต.ค. promptpay 60 ถูก** แต่ 9 ต.ค. cash 0 · 9–10: **9 ต.ค. cash 40 ถูก** · 3–9: รวม 7,260 → **ขายหายเฉพาะวันสุดท้ายของช่วง** · เงินจาก Payment ไม่หาย | `BUG-B-dashboard.png` · `BUG-B-report-3-9.png` |
| C | manager เข้าสู่ระบบ → `/manager/stock` ฟอร์มชำรุด WATER / STORE / 72 / เหตุผล → `/staff/stock` | "บันทึกของชำรุดแล้ว" · `stock-WATER-total` 48 · `stock-WATER-reorder` 48 · `stock-alerts` count 1 "! น้ำดื่ม 600 มล.: เหลือรวม 48 (จุดสั่งซื้อซ้ำ 48)" · ป้าย "ใกล้หมด" | `BUG-C-stock-48.png` |

### 3.1 ถ้าผลที่คาดหวังมาจากแหล่งอื่น จะจับได้ไหม

[O] = ลอกจากหน้าจอวันนี้ (โหมดบั๊ก) · [A] = เขียนจาก `web/SPEC.md` / `web/ASSETS.md` อย่างเดียว

| TC | ผลที่คาดหวังในแผน (ที่มา) | ถ้าเขียนจาก SPEC [A] | ถ้าลอกจากหน้าจอวันนี้ [O] | แต่ละแบบจับได้ไหม |
|---|---|---|---|---|
| TC-BOOK-04 | 24 ต.ค. ไม่มีปุ่ม/`out-of-range`/"จองล่วงหน้าได้ไม่เกิน 14 วัน" ([D] BR-04 E12–E14 · 9 + 15) | SPEC มีแค่ "`out-of-range` (เกิน 14 วัน)" และข้อความ `TOO_FAR_AHEAD` "ไม่เกิน 14 วัน" ไม่มีตัวอย่างวันที่ → ต้องตีความเองว่านับ +14 จากวันนี้ (23 ได้ 24 ไม่ได้) หรือ 14 วันรวมวันนี้ (22 ได้ 23 ไม่ได้) | ปุ่มถึง 24 ต.ค. · 24 ต.ค. `free` · จองได้ | [D] ✅ · [A] ⚠️ จับได้เฉพาะเมื่อตีความแบบ +14 (ตีความอีกแบบ test จะล้มทั้ง 2 โหมด = แยกบั๊กไม่ได้) · [O] ❌ |
| TC-BOOK-10 (E14) | `TOO_FAR_AHEAD` ([D] TEST-DATA E14) | เหมือนข้างบน (code มีใน SPEC แต่ขอบไม่ชัด) | สร้างได้ 201 | [D] ✅ · [A] ⚠️ · [O] ❌ |
| TC-DASH-01 | today 40 · week 7,300 ([D] 5.4) | SPEC ส่วน seed มี "9 ต.ค. 09:00 WATER 4 = ฿40 CASH" + "8 ต.ค. ORS 3 = ฿60" และ `dash-today-sales` → คิดได้ว่าวันนี้ต้อง ฿40 | today 0 · week 7,260 | [D] ✅ · [A] ✅ (seed ขายอยู่ใน SPEC) · [O] ❌ |
| TC-DASH-02 | sales 60 · total 860 · week 8,120 ([D] BR-40, A-37) | SPEC บอก BR-40 → `summarizeMoney` ใช้ใน dashboard + seed ขาย ฿40 → 40 + 20 = 60 | sales 0 · total 800 | [D] ✅ · [A] ✅ · [O] ❌ |
| TC-SALE-01 | dash-today-sales 80 ([D] E135 + seed) | ราคาของ (WATER ฿10 ORS ฿20) + seed ขาย ฿40 อยู่ใน SPEC → 80 | 0 | [D] ✅ · [A] ✅ · [O] ❌ |
| TC-REPORT-02 | 8–8 ต.ค. promptpay 60 · total 4,860 ([D] E144) | SPEC มี seed ขาย 8 ต.ค. ฿60 PROMPTPAY + คอลัมน์ "ขายพร้อมเพย์" → 60 (ยอดจอง 4,800 ต้องคิดจาก seed การจองใน SPEC ข้อ 1) | promptpay 0 · 4,800 | [D] ✅ · [A] ✅ · [O] ❌ |
| TC-REPORT-03 | CSV รวมรับเงิน 7300 ([D] 5.4) | คิดจาก seed ใน SPEC ได้เช่นกัน (ยาวกว่า · เสี่ยงคิดพลาด) | 7260 | [D] ✅ · [A] ✅ (ถ้าคิดครบ) · [O] ❌ |
| TC-STOCK-03 (E129) | รวม 48 = จุด 48 → ไม่เตือน ([D] BR-35 "ต่ำกว่า" · E129) | SPEC มี "WATER … (จุด 48)" และชื่อฟังก์ชัน `isBelowReorder` + `below?` ใน API แต่ไม่มีประโยคกฎหรือค่าขอบ → อนุมานจากคำว่า "below" ได้ว่า 48 ไม่เตือน | เตือน 1 รายการ | [D] ✅ · [A] ⚠️ (จับได้ถ้าอ่านชื่อฟังก์ชันตรงตัว · oracle อ่อน) · [O] ❌ |

ข้อสังเกต: [O] จับไม่ได้ทุกข้อ — หน้าจอ/API/CSV ผิดตรงกันหมด ไม่มี error 500 · ถ้าลอกจากหน้าจอโหมดปกติแทน ค่าจะตรงกับ [D] โดยบังเอิญ แต่หน้าจอโหมดปกติก็ "ไม่มี" กรณี 48 พอดีหรือ 24 ต.ค. ให้ลอก (seed ไม่มีของเท่าจุดพอดี) จึงยังต้องอาศัย TEST-DATA สร้างกรณีขอบอยู่ดี

## 4. ส่วนที่ 3 — เปิด `web/BUGS.md` (ตาราง v2 · 3 ตัว) แล้วเทียบ

| # บั๊กที่ฝัง (BUGS.md) | BUG ที่เราตั้งชื่อ | TC ที่จับได้ | จับได้ไหม | oracle ที่จับ |
|---|---|---|---|---|
| 1 เงิน BR-40 — ยอดขายหน้าเคาน์เตอร์ของวันสุดท้ายของช่วงไม่ถูกนับ (แดชบอร์ด + รายงาน/CSV) · Payment ยังถูก | B (ตรงทั้งอาการและขอบ "วันสุดท้ายของช่วง" ที่ MCP พิสูจน์ด้วยช่วง 8–9 / 9–10) | TC-DASH-01, DASH-02, SALE-01, REPORT-02 (P1) · REPORT-03 (P2) · (REPORT-04 เห็นค่าผิดด้วยแต่ล้มอยู่แล้ว) | ✅ | [D] TEST-DATA 5.4 / E135 / E144 + [E sql] · [A] ก็จับได้ (seed ขายอยู่ใน SPEC) |
| 2 การจอง BR-04 — จองล่วงหน้าได้ 15 วัน (ตาราง / ปฏิทิน / quote / สร้าง / แชทบอท) | A (ตรง · maxDate 2026-10-24) | TC-BOOK-04, TC-BOOK-10 (P1) | ✅ (ส่วนหน้าเว็บ + API) · ⚠️ ส่วนแชทบอทไม่มี TC ตรวจ | [D] E12–E14 Boundary · [A] ได้แบบมีเงื่อนไข |
| 3 สถานะหลังทำรายการ BR-35 — เตือนเมื่อยอดรวม **เท่ากับ** จุดสั่งซื้อซ้ำ (รายการเตือน + ป้าย "ใกล้หมด" + ตัวเลขแดชบอร์ด) | C (ตรง) | TC-STOCK-03 (P2) | ✅ (รายการเตือน + ป้าย) · ⚠️ ตัวเลข `dash-low-stock` ตอน 48 ไม่มี TC ตรวจ | [D] E128–E130 Boundary · [A] อ่อน |

**จับได้ 3 / 3 ตัว** · oracle [D]/[R] จับได้ 3/3 · [A] จับได้ชัด 1/3 (BR-40) + แบบมีเงื่อนไข 2/3 (BR-04 ตีความขอบ · BR-35 ชื่อฟังก์ชัน) · [O] จับได้ 0/3

### 4.1 จุดที่ยังพลาด / oracle อ่อน → TC ที่ควรเพิ่ม

| ช่องว่าง | ขาดเทคนิค / oracle อะไร | TC ที่ควรเพิ่ม |
|---|---|---|
| แชทบอทตอบว่าจอง 24 ต.ค. ได้ (BUGS.md บอกว่าแชทผ่านด้วย) — ไม่มี TC CHAT ที่ถามวันขอบ 14 วัน | Boundary ในโมดูล CHAT (มีแต่ราคา/ว่าง) · oracle ต้องมี/ห้ามมี จาก BR-04 | **TC-CHAT-21** "จองวันที่ 24 ต.ค. ได้ไหม" → ต้องมี "14 วัน" / "ไม่ได้" · ห้ามมีการ์ดยืนยันจอง · คู่ "23 ต.ค." → ต้องว่าง/จองได้ |
| `dash-low-stock` ตอนยอดรวม = จุดพอดี — STOCK-03 ตรวจแดชบอร์ดเฉพาะตอน 47 | Boundary ครบ 3 จุดต่อทุกจอที่แสดงค่าเดียวกัน (ตรวจตัวเลขข้างเคียงบนจออื่น) | เพิ่ม step ใน TC-STOCK-03: หลังรวม 48 → `dash-low-stock` 0 และ `stock-WATER-low` ไม่มี |
| เตือนหลัง **ขาย/ย้าย/ปรับยอด** ให้เท่าจุดพอดี (BUGS.md: ทุกทางที่ทำให้ยอดเท่าจุด) — เราทดสอบแค่ชำรุด | State transition หลายทางเข้า | **TC-STOCK-06** ขายน้ำที่เคาน์เตอร์จนรวม 48 (เช่น ปรับ STORE ลงก่อนแล้วขาย) → ไม่เตือน · ขายอีก 1 (47) → เตือน |
| รายงานที่ช่วง **จบ** ในวันที่มีขาย นอกจาก 8–8 / 3–9 — และ TC-REPORT-04 ที่เห็นค่าผิดถูก "บัง" เพราะล้มจากเรื่องอื่น | Equivalence ของตำแหน่งวันในช่วง (ต้น / กลาง / ท้าย) · แยก assert ที่ล้มอยู่แล้วออกจาก assert เงิน (soft แล้วแต่ข้อเดียวกัน) | **TC-REPORT-06** ช่วง 8–9 ต.ค. → 8 ต.ค. ขาย 60 และ 9 ต.ค. ขาย 40 · ช่วง 9–9 → 40 · แยกตัวเลขเงินของ REPORT-04 ไปเป็น TC ของตัวเองเพื่อไม่ให้ถูกบัง |
| แผน 8.1 ไม่มีแถวขอบ 14 วัน / ขอบจุดสั่งซื้อซ้ำ | การทายความเสี่ยง (risk-based) ครอบเฉพาะกฎเวลา | เพิ่มแถว 8.1: "BR-04 ขอบเลื่อน ±1 วัน → BOOK-04, BOOK-10, (CHAT-21)" · "BR-35 `≤` แทน `<` → STOCK-03, (STOCK-06), DASH-01" · "BR-40 ตัดวันสุดท้ายของช่วง → DASH-01/02, SALE-01, REPORT-02/03, (REPORT-06)" |

## 5. สรุปสั้น

| เบราว์เซอร์ | โหมดปกติ รอบ 1 (P1 · รวม) | โหมดปกติ รอบ 2 (P1 · รวม) | โหมดบั๊ก (P1 · รวม) | ผ่านเกณฑ์ |
|---|---|---|---|---|
| chromium | 72/74 · 117/128 | 72/74 · 117/128 | 66/74 · 109/128 | ❌ / ❌ / ❌ |
| firefox | 71/74 · 116/128 | 72/74 · 117/128 | 65/74 · 108/128 | ❌ / ❌ / ❌ |
| webkit | 72/74 · 117/128 | 72/74 · 117/128 | 66/74 · 109/128 | ❌ / ❌ / ❌ |

- GIF / MP4 โหมดบั๊ก (เก็บเฉพาะ TC ที่ล้มใหม่): 11 / 11 (8 TC) · หลักฐานโหมดปกติคืนครบ 138 / 138
- บั๊กจับได้ 3 / 3 · [D]/[R] 3 · [A] 1 ชัด + 2 มีเงื่อนไข · [O] 0
- ล้มใหม่ 8 TC = เว็บผิด (บั๊กที่ฝัง) · ล้มเหมือนเดิม 11 TC = เว็บผิด 10 + ไม่ได้รัน 1 · flaky 1 (MEMBER-06 Firefox)
- จบรอบในโหมดปกติ: `data-bug-mode="0"` · bugMode 0 · chatMode mock · reset `{}` แล้ว
