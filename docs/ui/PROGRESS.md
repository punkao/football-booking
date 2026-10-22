# งาน 2 (UX/UI) · สถานะสำหรับทำต่อ

แผนที่ผู้ใช้อนุมัติ: `docs/UI-REDESIGN.md` (อนุมัติทั้ง 6 ข้อ 2026-10-22 + ปุ่มแชทห้ามทับเนื้อหา)
ร่างหน้าตา: `docs/ui/mockups/` · ภาพก่อนแก้: `docs/ui/before/` · ตัวตรวจ: `tools/testid-snapshot.mjs --compare docs/ui/testid-before.json` · `e2e/tests/my/a11y.spec.ts`
แนวออกแบบ: skill frontend-design (Anthropic) — ทำ 2 รอบ (วาง token แล้วตรวจกับแบบ AI ทั่วไปก่อนเขียนโค้ด) · จุดเด่นจุดเดียว = "ตั๋วจอง"

| ชิ้น | งาน | สถานะ | commit |
|---|---|---|---|
| S0 | testid snapshot + axe baseline (serious 32) | ✅ | 7b1f95f |
| S1 | design tokens · contrast · ปุ่ม/ฟอร์ม/focus · nav 375 (ปุ่มเมนู) · ท้ายหน้าเว้นที่ให้ปุ่มแชท | ✅ testid 904→904 · chromium 117 · serial 86 · axe serious 32→0 | cdcc848 |
| S2 | แชท: แผงข้างเต็มสูง (desktop) / เต็มจอ (375) · ป้ายบอท · ปุ่มคำถามด่วน 4 ปุ่ม · การ์ดราคาแบบตั๋ว | ✅ testid 904→904 (เทียบ before: สับเซ็ต exit 0) · chromium chat/cr-04/cr-05/known-issues/v2/mob/layout/chat-ui 69 · firefox+webkit chat.spec+chat-ui+layout 78 · serial 86 (+1 skip) · unit 144 · golden · smoke 10/10 · axe หน้าหลัก serious/critical 0 + แชทเปิด 0 · ทดลองโหมด ai ผ่านแล้วคืน mock | |
| S3 | หน้าแรก (แผงรอบว่างวันนี้) · /book · /book/new ตัวบอกขั้น 4 ขั้น (ขั้น 1–2 หน้าเดียว) + แถบจ่ายติดล่าง · /booking · /pay · ตั๋วจอง | ⏳ | |
| S4 | หลังบ้าน: เมนูข้างจัดกลุ่ม · แดชบอร์ด · ตารางที่ 375 · ฟิลเตอร์ · โซนอันตราย (ไม่เพิ่มขั้นยืนยันปิดสนามฝน) | ⏳ | |
| S5 | ภาพ after (`node tools/ui-shots.mjs --out docs/ui/after`) + ตารางก่อน/หลังใน UI-REDESIGN.md · e2e เต็ม 3 เบราว์เซอร์ · golden · smoke · unit · a11y gate (`A11Y_GATE=1` ไม่มี serious/critical) · GIF ใหม่เฉพาะหน้าที่เปลี่ยน · code review (Opus) | ⏳ | |

## วิธีทำต่อ (ต่อชิ้น)
1. ตรวจ: `node tools/testid-snapshot.mjs --compare docs/ui/testid-before.json` (exit 0) · e2e เฉพาะ spec ของหน้าที่แก้บน chromium (`--no-deps`) และ serial แยกกัน · `cd web && npm test` · `node tests/golden/check.mjs` · `node tests/smoke.mjs` · axe นับเทียบ before · ดูภาพ wip ด้วยตาตัวเอง
2. rebuild เว็บ: `BUG_MODE=0 ALLOW_TEST_RESET=1 docker compose -f web/compose.yaml up -d --build` (Git Bash · ใส่ -p ไม่ต้อง ใช้ชื่อเดิม)
3. คืนไฟล์รายงาน: `git checkout -- e2e/test-report e2e/index.html e2e/plan-cases.json`
4. commit ชื่อ `งาน 2 S<n>: …` + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` · อัปเดตตารางข้างบน · **ห้าม push**

## ข้อตัดสินระหว่างทาง (ผู้ใช้หลับ · ทีมเลือกเองตามหลัก "ใช้ได้ทั้งตอนนี้และอนาคต")
(เพิ่มทีละข้อ: เรื่อง · ทางเลือก · ที่เลือก · เหตุผล)
- **S2 · ปุ่มเปิดแชทตอนแผงเปิด**: แผน/คำสั่งบอก "ซ่อนขณะแผงเปิด" แต่ `testid-snapshot --compare` ถือว่า testid ที่เคยเห็นแล้วซ่อนที่ 1280 = FAIL → ที่ ≥768px ปุ่ม `chat-open` ยังเห็นอยู่ ย้ายไปชิดขอบซ้ายของแผง (ข้อความ "ปิดแชท", aria-expanded=true) ไม่ทับแผง/เนื้อหา (เนื้อหาถอยซ้ายแล้วและท้ายหน้ามี --fab-room) · ที่ <768px (เต็มจอ) ซ่อนจริงด้วย display:none ใช้ `chat-close`
- **S2 · เนื้อหาถอยซ้าย**: ตั้ง `html[data-chat="open"]` จาก ChatWidget (ไม่ใช้ `body:has`) แล้ว `margin-right:400px` เฉพาะ `#main` กับ footer ≥1100px (หัวเว็บยังเต็มกว้างตามร่าง) · แผงเริ่มใต้หัวเว็บตามความสูงจริง (`--chat-top` วัดจาก .site-header)
- **S2 · โฟกัส/คีย์บอร์ด**: เปิด → โฟกัสช่องพิมพ์ (desktop) หรือตัวแผง (375 กันคีย์บอร์ดเด้ง) · Esc ปิดแล้วคืนโฟกัสที่ปุ่มเปิด · 375 เป็น role=dialog aria-modal + วนโฟกัสในแผง + ล็อกเลื่อนหน้าหลัง · ปุ่มเปิดไม่บังตัวที่โฟกัส: `html{scroll-padding-bottom}` + ตัวดัก focusin เลื่อนหน้า (WebKit ไม่ใช้ scroll-padding ตอนโฟกัส) พิสูจน์ด้วย e2e/tests/my/chat-ui.spec.ts 3 เบราว์เซอร์
- **S2 · คำถามด่วน**: ข้อความที่ส่ง = ตามร่าง (ราคาสนามเท่าไร / วันนี้มีรอบว่างไหม / อยากจองสนาม / เปิดกี่โมง + EN) ผ่าน submit() เดียวกับช่องพิมพ์ · ตรวจกับ mock และโหมด ai (mock-llm) แล้ว · หมายเหตุ: "วันนี้มีรอบว่างไหม" ที่ไม่ระบุสนาม/เวลา บอท mock ตอบราคา + ขอสนาม/วันที่/เวลา (ไม่ได้ลิสต์รอบว่าง) — ไม่แก้สมองแชท · ชิปต่อเนื่อง "จองรอบนี้/ดูสนาม B" ข้าม (ตัวเลือกเสริมตามแผง)
- **S2 · แก้ race เดิม**: โหลดประวัติแชทตอนเปิดเคยเขียนทับข้อความที่ผู้ใช้เพิ่งส่ง (กดชิปทันทีหลังเปิด) → ตอนนี้ไม่ทับถ้ามีข้อความบนจอแล้ว
- **S2 · ข้อความใหม่**: การ์ดใช้ .ticket/.perf/.stub ของ S1 · ท่อน "จ่ายหน้าสนาม" คำนวณจาก dueAtField (ไม่มี testid ใหม่ในการ์ด เพื่อไม่ให้ ChatRoom.lastBot() จดคีย์เพิ่ม) · ใต้ปุ่มยืนยันมีบรรทัด "ยังไม่มีการตัดเงิน ถ้าไม่จ่ายภายใน 15 นาที รอบนี้จะถูกปล่อยว่าง" · ข้อความ chat-count เปลี่ยนเป็น "บอทนี้ยกเลิกหรือเลื่อนการจองไม่ได้" (เทสต์ตรวจเฉพาะ data-value)
