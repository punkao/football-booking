# งาน 2 (UX/UI) · สถานะสำหรับทำต่อ

แผนที่ผู้ใช้อนุมัติ: `docs/UI-REDESIGN.md` (อนุมัติทั้ง 6 ข้อ 2026-10-22 + ปุ่มแชทห้ามทับเนื้อหา)
ร่างหน้าตา: `docs/ui/mockups/` · ภาพก่อนแก้: `docs/ui/before/` · ตัวตรวจ: `tools/testid-snapshot.mjs --compare docs/ui/testid-before.json` · `e2e/tests/my/a11y.spec.ts`
แนวออกแบบ: skill frontend-design (Anthropic) — ทำ 2 รอบ (วาง token แล้วตรวจกับแบบ AI ทั่วไปก่อนเขียนโค้ด) · จุดเด่นจุดเดียว = "ตั๋วจอง"

| ชิ้น | งาน | สถานะ | commit |
|---|---|---|---|
| S0 | testid snapshot + axe baseline (serious 32) | ✅ | 7b1f95f |
| S1 | design tokens · contrast · ปุ่ม/ฟอร์ม/focus · nav 375 (ปุ่มเมนู) · ท้ายหน้าเว้นที่ให้ปุ่มแชท | ✅ testid 904→904 · chromium 117 · serial 86 · axe serious 32→0 | (commit นี้) |
| S2 | แชท: แผงข้างเต็มสูง (desktop) / เต็มจอ (375) · ป้ายบอท · ปุ่มคำถามด่วน 4 ปุ่ม · การ์ดราคาแบบตั๋ว | ⏳ | |
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
