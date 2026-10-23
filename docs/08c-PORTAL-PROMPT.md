# PORTAL-PROMPT — หน้า `/project` สำหรับอาจารย์ (เฟส 10 ส่วน Portal)

ผู้อ่านหลักคือ**อาจารย์ที่ตรวจงาน**: เปิดเว็บแล้วต้องเห็นภายใน 1 นาทีว่างานนี้คืออะไร ทำตามบทเรียนอย่างไร และพิสูจน์อย่างไรว่าเว็บทำงานจริง
ข้อมูลทุกอย่างอ่านจากไฟล์จริงตอนรัน (`docs/` และ `e2e/test-report/` ที่ mount อยู่แล้ว — ADR-09) **ห้าม hard-code ตัวเลขหรือผลทดสอบ**

## อ่านได้
`docs/` ทุกไฟล์ (อ่านอย่างเดียว) · `e2e/test-report/` (อ่านอย่างเดียว เพื่อดูรูปแบบ `results.json`, `run-info.json`, `TEST-REPORT*.md`, `gifs/`, `videos/`) · `web/` ทั้งหมด · `docs/process/PLAN.md`, `README.md`
**ห้ามแก้** `docs/`, `e2e/` · ห้ามเปลี่ยน seed / รหัส error / ข้อความ / `data-testid` เดิมของหน้าอื่น

## หน้าที่ต้องมี (ภาษาไทยเป็นหลัก ดีไซน์เดียวกับเว็บ)

| path | เนื้อหา |
|---|---|
| `/project` | **ภาพรวม**: ร้าน/โจทย์ 2–3 บรรทัด · ตัวเลขสำคัญอ่านจากไฟล์ (จำนวน US, FR, BR, NFR จาก `03`/`04` · จำนวน TC และ P1/P2/P3 จาก `09-TEST-PLAN.md` · ผลรันล่าสุด ผ่าน/ทั้งหมด/ผ่านเกณฑ์ไหม จาก `e2e/test-report` · บั๊กที่ฝังจับได้กี่ข้อ จาก `10-TEST-REPORT.md`) · **เส้นทางงานเฟส 0–8** (จากตารางสถานะใน `docs/process/PLAN.md` หรือรายการคงที่ของชื่อเฟส + ลิงก์ไปเอกสารของเฟสนั้น) · **ตารางโยงบทเรียน → งานนี้**: 00_tester (LAB สัมภาษณ์ → US → REQUIREMENTS → BUILD → TEST-PLAN → Playwright → BUG_MODE), 01 Loop/Graph/Dynamic (`docs/trace/phase2-loop.md`, `phase3-graph.md`, `phase7-5-fix.md`), 02 MCP (`00-ENVIRONMENT.md`, `05b-EXPLORATION.md`) · "อ่านอะไรก่อน" 5 ลิงก์ |
| `/project/docs` และ `/project/docs/[...slug]` | รายการเอกสารเรียงตามเลขไฟล์ (รวม `trace/`) · แสดง markdown แบบ GFM (ตาราง, โค้ด) · **Mermaid render ในเบราว์เซอร์จาก package ในเครื่อง ห้ามใช้ CDN** · ลิงก์ระหว่าง md เปลี่ยนเป็น route ของ portal · ลิงก์ไป `../e2e/test-report/...` และรูปใน `docs/diagrams` ใช้ได้ · มีสารบัญหัวข้อ |
| `/project/testcases` | ตาราง TC ทั้งหมดจาก `09-TEST-PLAN.md` (รหัส, โมดูล, สิ่งที่ทดสอบ, กฎ, ระดับ, ผลที่คาดหวัง) + **ผลล่าสุดรายเบราว์เซอร์** จาก `results.json` + ลิงก์ GIF/MP4 (เปิดดู GIF ในหน้าได้) · กรองตามโมดูล / ระดับ / ผล · TC ที่ข้ามแสดงเหตุผล |
| `/project/traceability` | US → FR/BR → TC (จาก `04` ส่วนที่ 5 และตาราง traceability ใน `09`) · แถวที่ไม่มี TC เน้นสี (ต้องเป็น 0) |
| `/project/report` | `10-TEST-REPORT.md` (ภาพรวมก่อน/หลัง + BUG_MODE เทียบเฉลย) และลิงก์ไปรายงานทุกฉบับใน `e2e/test-report/*.md` แสดงผลแบบเดียวกับ docs · ภาพ `bugmode1/*.png` แสดงได้ |

- เมนูย่อยของ portal บนทุกหน้า `/project/*` · ลิงก์ `nav-project` เดิมยังอยู่
- ไฟล์ที่ serve ออกจาก mount: อนุญาตเฉพาะ `.md .png .svg .gif .mp4 .json` ภายใต้ราก `docs/` และ `test-report/` เท่านั้น · กัน path traversal (`..`, path แบบสัมบูรณ์, symlink) · ไฟล์ใหญ่ (gif/mp4) ส่งแบบ stream รองรับ Range
- ถ้ายังไม่มีผลทดสอบ (clone ใหม่ยังไม่รัน) ต้องไม่ error: แสดง "ยังไม่มีผลทดสอบ — รัน `cd e2e && npm test`" (`project-no-report` เดิม)
- จอ 375 px ไม่มีเลื่อนแนวนอนทั้งหน้า (ตารางกว้างเลื่อนในกรอบของตัวเอง) · NFR-13 (heading, label, alt)
- `data-testid` ใหม่ขึ้นต้น `project-` · `<html data-ready="true">` เมื่อโหลดเสร็จเหมือนหน้าอื่น
- อัปเดต `web/SPEC.md` ส่วน `/project` และเพิ่มท้าย CHANGELOG (`web/CHANGELOG-7.5.md` ส่วนใหม่ "เฟส 10 Portal")

## ตรวจเองก่อนส่ง
1. `docker compose up -d --build` healthy · `BUG_MODE=0` · reset `{}` ตอนจบ
2. selfcheck เดิมผ่านทั้งหมด (ไม่กระทบกฎ) · unit test · lint · tsc
3. สคริปต์ใหม่ `web/selfcheck/portal-check.mjs` (Playwright จาก `tools/`): เปิดทุกหน้า portal + เอกสารทุกไฟล์ใน `docs/` → ไม่มี console error · Mermaid ทุกบล็อกกลายเป็น SVG · ลิงก์ภายใน portal ไม่มี 404 · ตัวเลขบนหน้า `/project` ตรงกับที่นับจากไฟล์ (นับซ้ำในสคริปต์) · path traversal ถูกปฏิเสธ · 375 px ไม่เลื่อนแนวนอน
4. ภาพ `web/selfcheck/screens/p10-*.png` ทุกหน้า portal ที่ 1280 และ 375 px

## รายงาน
ตาราง: หน้า | ทำแล้ว/บางส่วน | วิธีตรวจ · ผล selfcheck / portal-check · สิ่งที่ตัดสินใจเอง · ข้อจำกัด
