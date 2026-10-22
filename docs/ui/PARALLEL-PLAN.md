# งาน 2 · แผนทำ S3 + S4 พร้อมกัน (ผู้ใช้อนุมัติ 2026-10-22)

เป้า: เร็วกว่าทำทีละชิ้น (~3 ชม. → ~1 ชม. 45 น.) โดยความถูกต้องและความปลอดภัยเท่าเดิมหรือดีกว่า · **ไม่แก้เทสต์เดิม → ไม่ต้องมีแถว ORACLE-CHANGES**

## หลักที่ทำให้ทำพร้อมกันได้อย่างปลอดภัย
- เทสต์ e2e เดิมบางไฟล์ผูก `docker exec football-db` ตายตัว (`tests/v2-helpers.ts:27` ใช้ใน 18 ไฟล์ · `tests/chat-helpers.ts:139` · serial 3 ไฟล์) → **e2e ทั้งหมดรันบนระบบหลักเท่านั้น ทีละชิ้น ตอนปิดชิ้น**
- เครื่องมือตรวจระหว่างแก้คุยผ่าน HTTP อย่างเดียวและเปลี่ยนเป้าได้: `tools/testid-snapshot.mjs --base --only` · `tools/ui-shots.mjs --base` · `tests/smoke.mjs` (`BASE_URL`) · `e2e/tests/my/a11y.spec.ts` (`BASE_URL`) → ใช้บนระบบแยกได้ ไม่มีทางแตะฐานจริง

## สองสาย
| | สาย A · หน้าลูกค้า (S3) | สาย B · หลังบ้าน (S4) |
|---|---|---|
| ที่ทำงาน | repo หลัก (branch main) | git worktree `../fb-s4` branch `ui-s4` จาก commit เดียวกับ A (หลัง S2b) |
| ระบบระหว่างแก้ | `next dev -H 127.0.0.1 -p 3101` → ฐานเดโม `fbs3` (`127.0.0.1:5434`) | `next dev -H 127.0.0.1 -p 3201` → ฐานเดโม `fbs4` (`127.0.0.1:5435`) |
| เจ้าของไฟล์ | `web/app/globals.css` · `web/components/ui.tsx` · หน้า `/`, `/book*`, `/booking*`, `/pay*`, `/fields`, `/my`, `/series`, `/challenges` | `web/app/owner/**` · `web/app/staff/**` · `web/app/manager/**` · `web/app/backoffice.css` (ใหม่) · `web/components/backoffice/**` (ใหม่) |
| ห้ามแตะ | ไฟล์ของสาย B | `globals.css` · `ui.tsx` · `Nav.tsx` · `ChatWidget.tsx` (ต้องแก้ไฟล์กลาง → แจ้ง lead) |

ระบบเดโม: `docker compose -p fbs3 up -d db migrate` ด้วย `FB_NAME=fbs3 FB_PGDATA=fbs3-pgdata FB_NETWORK=fbs3-net DB_PORT=127.0.0.1:5434` (เหมือนกันสำหรับ fbs4) · รหัสเดโมใน git · ไม่เปิด `.env` · **ห้าม `docker compose config` ในโฟลเดอร์จริง** (พิมพ์ค่าจาก .env) · worktree ใช้ `node_modules` เดิมผ่าน junction (ไม่ดาวน์โหลด)

## ด่านตรวจ
**ก่อนเขียนโค้ด (ทั้งสองสาย):** เขียนเงื่อนไขเป็นเทสต์ใหม่ใน `e2e/tests/my/` ที่ต้องแดงก่อน · lead ดูว่าแดงด้วยเหตุผลที่ถูก
- S3: แผงรอบว่างหน้าแรก = `/api/availability` ทุกช่อง · ตั๋ว "จ่ายตอนนี้/จ่ายหน้าสนาม" = `/api/quote` · ตัวบอกขั้นตรงกับขั้นจริง (4 ขั้น · ขั้น 1–2 หน้าเดียว) · ข้อความ error เดิมครบทุกตัวอักษร + บรรทัดวิธีแก้แยก · แถบจ่ายติดล่างที่ 375
- S4: ตัวเลขแดชบอร์ด = API รายงานวันเดียวกัน · ปุ่มอันตรายอยู่ในกรอบแดง กดครั้งเดียวมีผลเหมือนเดิม (ไม่เพิ่มขั้นยืนยัน) · ตารางกว้างไม่ทำให้ทั้งหน้าเลื่อนแนวนอนที่ 375 · เมนูข้างจัดกลุ่ม ใช้คีย์บอร์ดได้

**ระหว่างแก้:** dev server + เทสต์ของหน้านั้น (HTTP เท่านั้นบนระบบแยก) + `testid-snapshot --only <หน้า> --base <dev>` + axe + ภาพ 1280/375 TH/EN

**ปิดชิ้นบนระบบหลัก (ทีละชิ้น A ก่อน B):** build จริง (`docker compose -f web/compose.yaml up -d --build`) · `testid-snapshot --compare` เต็มชุด exit 0 · e2e ของหน้านั้นบน chromium+firefox+webkit · serial · unit · golden · smoke · lead ดูภาพเอง → commit · สาย B: merge `ui-s4` → main แล้วตรวจชุดเดียวกัน

**S5 ด่านสุดท้าย (ครั้งเดียว):** e2e เต็ม `RUN_MIGRATION_TEST=1 node run-all.mjs` · golden · unit · smoke · portal-check · `A11Y_GATE=1` (serious/critical = 0) · ภาพ after ทุกหน้า + ตารางก่อน/หลังใน UI-REDESIGN.md · GIF ใหม่เฉพาะหน้าที่เปลี่ยน · Opus code review ทั้ง diff (เน้นคำสั่งแชทใหม่ของ S2b ที่เรียกข้อมูลรอบว่างฝั่ง server)

## ความปลอดภัย (ตรวจทุกช่วง)
- ก่อน/หลังทุกช่วง: `football-db` + `football-web` healthy · `/api/version` = 009 · smoke :3000 = 10/10 · `docker volume ls` มี `football-pgdata`
- ระบบแยกใช้ `-p` + ชื่อเต็มทุกตัว · พอร์ตผูก 127.0.0.1 (ตรวจด้วย netstat)
- ด่านไม่ผ่าน = ไม่ merge (แต่ละสายอยู่บน branch ของตัวเอง ถอยได้ทันที)
- เก็บกวาด: `docker compose -p fbs3 down` / `-p fbs4 down` · ลบ volume `fbs3-pgdata` `fbs4-pgdata` ด้วยชื่อเต็ม · `git worktree remove ../fb-s4` · เทียบ `docker volume ls` ก่อน/หลัง
- ห้าม push จนกว่าผู้ใช้สั่ง
