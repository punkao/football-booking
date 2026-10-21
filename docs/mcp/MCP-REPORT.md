# รายงานสั้น MCP · ลูกหนัง อารีน่า (บท 02_MCP/02 · 8.3)

## 1. N×M → N+M ด้วยตัวอย่างของเรา
ถ้า host แต่ละตัวต้องต่อกับ tool แต่ละตัวเอง: host 3 ตัว (Claude Code แบบโต้ตอบ · `claude -p` · สคริปต์ MCP client เช่น `tools/mcp-football/test-client.mjs`) × server 3 ตัว (playwright · excalidraw · football) = **9 ตัวเชื่อม** · ใช้ MCP แล้วแต่ละฝั่งพูด JSON-RPC (`tools/list` / `tools/call`) แบบเดียวกัน = **3 + 3 = 6** และถ้าเพิ่ม server ตัวที่ 4 เขียนแค่ 1 ตัว ไม่ใช่ 3 ตัวเชื่อม (ภาพ `docs/mcp/excalidraw/03-n-times-m.png`) · หมายเหตุตรงไปตรงมา: Claude Code กับ `claude -p` เป็นโปรแกรมเดียวกันคนละโหมด จึงนับเป็น host คนละตัวเพื่ออธิบายหลักการเท่านั้น

**ต่างจากเรียก API ตรง ๆ อย่างไร:** `/api/availability` `/api/quote` `/api/bookings` คือ API ที่ "คนเขียนโค้ด" ต้องรู้ URL/รูปแบบเอง · server `football` ห่อ API เดิมเป็น tool ที่มี schema + คำอธิบายไทย/อังกฤษ ให้ LLM **ค้นพบเอง** ผ่าน `tools/list` พร้อมจุดขออนุมัติและกฎกันพลาด (`book` ต้อง `confirm:true` + เฉพาะ localhost + ไม่จ่ายเงิน) · กติการาคา/ช่องว่างยังอยู่ที่เว็บที่เดียว (quote ที่ได้ตรงกับ `POST /api/quote` ทุกตัวเลข)

## 2. แต่ละ Lab ได้อะไร · สถานะ C1–C3
| Lab | สิ่งที่ได้ (ไฟล์หลักฐาน) | C1 | C2 | C3 |
|---|---|---|---|---|
| **5 Excalidraw** (25%) | 3 ภาพ + รอบแก้ before/after: `docs/mcp/excalidraw/01-architecture-before.png` → `01-architecture.png` · `02-booking-flow.png` · `03-n-times-m.png` (ทุกภาพมี `.excalidraw` คู่กัน · 46–47 elements) · สคริปต์ `tools/mcp-football/excalidraw-run.mjs` | ✅ ครบ 3 + ก่อน/หลังเทียบกันได้ (รอบแก้: football เป็นสีเขียว · เพิ่ม client #2 · ป้ายกฎ `book`) | ✅ ตรวจ screenshot ก่อน export: ข้อความไม่ล้นกล่อง ลูกศรไม่ทับกล่อง (ภาพ 2 รอบแรกลูกศร full→pay ทะลุกล่อง "มัดจำ" แก้แล้ว) | ✅ `docs/mcp/excalidraw-trace.jsonl` 89 บรรทัด 6 รอบรัน · tool error 0 · ⚠ ผู้เรียก tool คือ **สคริปต์ MCP client** (session ผู้ทำงานไม่มี MCP tool) ไม่ใช่ LLM — แก้ layout ด้วยการแก้รายการ element แล้ววาดใหม่ (`clear_canvas`+`batch_create_elements`) ยกเว้นรอบแก้ภาพ 1 ใช้ `update_element` ×2 + `batch_create_elements` ×1 |
| **6 Playwright** (25%) | อยู่นอกงานชุดนี้ (มีอยู่แล้วที่ `tools/mcp-client.mjs` + `docs/TEST-RUN-MCP.md`) | – | – | – |
| **7 server ของเรา** (35%) | `tools/mcp-football/server.mjs` (3 tool + resource `football://prices`) · `test-client.mjs` · `run-claude.mjs` · ลงทะเบียน `.mcp.json` ชื่อ `football` | ✅ `docs/mcp/football-client-output.txt` 13/13: tools/list · quote ตรง `/api/quote` · book confirm แล้วตรวจผ่าน `GET /api/bookings/<code>` · ไม่ confirm/ไม่ localhost ถูกปฏิเสธ | ✅ `docs/mcp/football-wire.log` 36 ข้อความ JSON-RPC (`tools/list` · `tools/call` ของทั้ง 3 tool) เวอร์ชันโปรโตคอลที่เห็น **2025-11-25** (SDK 1.32.1 — ไม่ใช่ 2026-07-28 ที่บทเรียนอ้าง) | ⚠ **ยังไม่ผ่านจนจบ**: `claude -p` ต่อ server ได้ (`status: connected` เห็น 3 tool `mcp__football__*` ใน system/init) แต่ LLM ไม่ตอบ — `401 OAuth access token has expired` (ลอง 2 ครั้ง) · ดู `docs/mcp/football-claude-run.md` |

## 3. ข้อควรรู้ / ความเสี่ยงที่พบจริง
- **พอร์ตชน**: canvas ของ excalidraw ค่าเริ่มคือ `:3000` = พอร์ตเว็บร้านเอง · ผมใช้ `PORT=8892` และ `EXPRESS_SERVER_URL=http://127.0.0.1:8892` ในสคริปต์ แต่ entry `excalidraw` ใน `.mcp.json` **ยังไม่มี env นี้** (ตามคำสั่งไม่แตะ) → ถ้าเปิดผ่าน Claude Code ตรง ๆ อาจชนเว็บ ควรเติม env เมื่อทีมอนุญาต
- renderer headless ของ excalidraw ใช้ฟอนต์สำรองกับภาษาไทย (ตัวเล็กและคนละฟอนต์) → ส่งออกด้วย `renderer: "browser"` ผ่านแท็บ canvas ที่ Playwright เปิดไว้ ได้ภาพที่อ่านง่ายกว่า
- `book` สร้างลูกค้า+การจองจริงในฐานข้อมูล → ใช้เฉพาะฐานทดสอบ แล้ว `POST /api/test/reset {}` (test-client ทำให้เอง)

## 4. รันซ้ำ (จากโฟลเดอร์ `football-booking/` · เว็บเปิดที่ :3000 · seam เปิด)
```
node tools/mcp-football/test-client.mjs                 # C1+C2 server ของเรา (เขียน docs/mcp/football-wire.log)
node tools/mcp-football/run-claude.mjs                  # C3 claude -p (ต้องล็อกอิน Claude ก่อน · CLAUDE_BIN=<path> ถ้าไม่มี claude ใน PATH)
node tools/mcp-football/excalidraw-run.mjs all          # วาดใหม่ 3 ภาพ (ต่อท้าย trace · หยุด canvas เองตอนจบ)
```
