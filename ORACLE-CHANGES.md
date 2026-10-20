# ORACLE-CHANGES · ค่าที่คาดหวังเดิมที่ต้องเปลี่ยนเพราะ CR (รอ lead อนุมัติ · ทีม CR ไม่แก้เทสต์เดิมเอง)

กติกา: `CLAUDE.md` หัวข้อ "ห้ามแตะ" · `legacy/CR-PROMPT.md` ขั้น 4 · ค่าใหม่ต้องมีที่มาเป็น CR (`[D:CR-0N]`) ไม่ใช่ "ผลที่ระบบตอบตอนนี้"

| วันที่ | ไฟล์ | เคส | ค่าเดิม → ใหม่ | CR | ผู้อนุมัติ |
|---|---|---|---|---|---|
| 2026-10-20 | `e2e/tests/v2.serial.spec.ts:1422` | TC-DATA-03 ขั้น "ก่อน: … [E sql:migrations] 001–006" | `schema_migrations` = `['001'…'006']` → `['001'…'007']` (ชื่อขั้น 001–006 → 001–007) | CR-01 migration `007_session_revocation` (`docs/impact/CR-01.md` 3.4) | รอ lead |
| 2026-10-20 | `web/selfcheck/rules-check.mjs:111` | V2.version | `schemaVersion === "006"` → `"007"` | CR-01 เหมือนข้างบน | รอ lead |
| 2026-10-20 | `CLAUDE.md:6` (กติกา ไม่ใช่เทสต์) | ตรวจหลังเปิดระบบ | `/api/version` = schemaVersion 006 → 007 | CR-01 เหมือนข้างบน | รอ lead |
