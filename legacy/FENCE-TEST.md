# FENCE-TEST — ทดสอบรั้ว `.claude/settings.json` (chunk D-2 · แผน L3 · บท 06 LAB 4)

ทำเมื่อ 2026-10-20 · ผู้ทดสอบ: subagent ทีมดูแลระบบ (เซสชันเดียวกับที่เขียน settings)

## รั้วที่ตั้ง (`permissions.deny` อย่างเดียว · ไม่มี allow)

| กฎ | กันอะไร |
|---|---|
| `Edit(e2e/tests/*.spec.ts)` · `Edit(e2e/tests/*.ts)` | แก้/เขียน spec และ helper เดิมที่ชั้นบนสุดของ `e2e/tests/` (`*` ไม่ข้าม `/` → `e2e/tests/cr/**` และ `e2e/tests/my/**` ยังเขียนได้) |
| `Edit(e2e/plan-cases.json)` · `Edit(docs/TEST-CASES.md)` | เฉลย/แผนเทสต์เดิม |
| `Read(web/BUGS.md)` | เฉลยบั๊กที่ฝัง |
| `Read(**/.env)` | `web/.env` `db/.env` (รหัสผ่าน · SESSION_SECRET) |
| `Read(**/_solution/**)` · `Read(../Teaching_CWN2026/**/_solution/**)` | เฉลยของอาจารย์ (โฟลเดอร์พี่น้องของ repo) |
| `Write(…)` 4 บรรทัด | **ไม่มีผล** — ดูหัวข้อ "ปัญหาที่เจอ" |

`Edit(...)` ครอบเครื่องมือแก้ไฟล์ทุกตัวของ Claude Code (Edit / Write / NotebookEdit) · deny **ไม่กันคำสั่ง shell** (`sed` `Set-Content` `cat`) → CLAUDE.md หัวข้อ "ห้ามแตะ" ห้ามซ้ำไว้

## ผลทดสอบในเซสชันนี้ (เขียน settings กลางเซสชัน)

| ทดสอบ | เครื่องมือ | ผล | หลักฐาน |
|---|---|---|---|
| เขียนไฟล์ใหม่ `e2e/tests/zz-fence-probe.ts` (ตรง `Edit(e2e/tests/*.ts)`) | Write | ❗ **ไม่ถูกปฏิเสธ** (สร้างได้) | ลบทันที · `git status --short e2e/tests` ว่าง |
| อ่านไฟล์ล่อ `tests/golden/fence-probe/.env` (เนื้อหา `PROBE=harmless-decoy` ที่สร้างเอง · ตรง `Read(**/.env)`) | Read | ❗ **ไม่ถูกปฏิเสธ** (อ่านได้) | ลบโฟลเดอร์ล่อแล้ว |
| Edit spec เดิม (`e2e/tests/constants.ts`) | – | **ไม่ได้ลอง** | ไฟล์ล่อพิสูจน์แล้วว่ารั้วยังไม่ทำงานในเซสชันนี้ → ถ้าลองจะ "แก้ไฟล์ที่ห้ามจริง" |
| Read `web/BUGS.md` | – | **ไม่ได้ลอง** | เหตุผลเดียวกัน → ถ้าลองจะ "เปิดเฉลยจริง" ซึ่งกติกาห้าม |

**สรุปตรง ๆ:** settings ที่เขียนกลางเซสชัน **ไม่มีผลกับเซสชันนี้** (ตรงกับข้อสังเกตบท 06: "settings ใหม่มีผลในเซสชันใหม่ ทดสอบในเซสชันเดิมอาจได้ผลหลอก") · จึงยัง **พิสูจน์ไม่ได้** ว่ารั้วปฏิเสธจริง ต้องทดสอบในเซสชันใหม่ตามขั้นด้านล่าง

### ลองเซสชันใหม่แบบ headless (ไม่สำเร็จ · เพราะ auth)

`claude.exe -p "<ขั้นทดสอบ 5 ข้อ>" --permission-mode acceptEdits` (Claude Code 2.1.299 ที่มากับแอป) จากโฟลเดอร์ repo:
- **โหลด `.claude/settings.json` จริง** และเตือนเฉพาะกฎ Write: `Permission deny rule (.claude\settings.json): Write(e2e/tests/*.spec.ts) is not matched by file permission checks — only Edit(path) rules are. Use Edit(e2e/tests/*.spec.ts) instead (Edit rules cover all file-editing tools).` (×4 กฎ Write) · กฎ `Edit(...)` และ `Read(...)` ไม่มีคำเตือน = รูปแบบถูกต้อง
- จากนั้นหยุดที่ `Failed to authenticate. API Error: 401 OAuth access token has expired.` → ไม่มีเครื่องมือใดถูกเรียก · `git status` หลังรัน: ไม่มีไฟล์เปลี่ยน

## ปัญหาที่เจอ (ให้หัวหน้า/ผู้ใช้ทำ)

1. **กฎ `Write(...)` 4 บรรทัดไม่มีผลและทำให้มีคำเตือนทุกเซสชัน** → ลบ 4 บรรทัดนี้ออกจาก `.claude/settings.json` (กฎ `Edit(...)` ครอบการเขียนแล้ว) · ผมลองเขียนไฟล์ใหม่แต่ **ถูก auto-mode classifier ปฏิเสธ (`[Self-Modification]`)** จึงไม่แก้อ้อมด้วย shell
2. กฎ `Read(../Teaching_CWN2026/**/_solution/**)` ชี้นอกโฟลเดอร์โปรเจกต์ — ยังไม่รู้ว่ารูปแบบ `../` จับได้ไหม (ไม่มีคำเตือนตอนโหลด) → ตรวจในเซสชันใหม่ด้วยไฟล์ที่ **ไม่มีอยู่จริง** (ข้อ 5 ด้านล่าง) ถ้าไม่ถูกปฏิเสธให้เปลี่ยนเป็น path แบบ absolute ของเครื่อง

## วิธีตรวจในเซสชันใหม่ (ปิดแล้วเปิด `claude` ธรรมดาในโฟลเดอร์ `football-booking/` · ห้าม `--dangerously-skip-permissions`)

ทำตามลำดับ (ไฟล์ล่อก่อน ของจริงทีหลัง เพื่อไม่ให้เปิดเฉลยถ้ารั้วรั่ว):

| ขั้น | สั่ง (ใช้เครื่องมือแก้/อ่านไฟล์ปกติ ห้าม shell) | ผลที่ต้องได้ |
|---|---|---|
| 1 | สร้างไฟล์ล่อ `tests/fence/.env` เนื้อหา `PROBE=1` (ด้วย shell ได้ เพราะไม่ใช่ไฟล์ลับ) แล้วให้ Claude **Read** ไฟล์นี้ | ปฏิเสธ (`…denied by your permission settings`) · ถ้าอ่านได้ = `Read(**/.env)` ไม่ทำงาน → หยุด ห้ามทำขั้น 4 |
| 2 | Edit `e2e/tests/constants.ts` เพิ่ม `// test fence` บรรทัดแรก | ปฏิเสธ · `git status --porcelain -- e2e/tests` ว่าง · ถ้าแก้ได้ → `git checkout -- e2e/tests/constants.ts` ทันที |
| 3 | Write ไฟล์ใหม่ `e2e/tests/cr/zz-allowed.ts` | **ทำได้** (โฟลเดอร์ cr/ ต้องเปิด) → ลบทิ้ง |
| 4 | (ทำเมื่อขั้น 1 ผ่านเท่านั้น) Read `web/BUGS.md` — ถ้าอ่านได้ห้ามสรุปเนื้อหา ตอบแค่ "อ่านได้ = รั้วอ่านไม่ทำงาน" | ปฏิเสธ |
| 5 | Read `../Teaching_CWN2026/00_tester/06_sabai-spa-legacy-change-request/_solution/x.md` (path ไม่มีจริง) | ปฏิเสธด้วยข้อความ permission (ไม่ใช่ "file not found") |
| 6 | Edit `docs/TEST-CASES.md` และ `e2e/plan-cases.json` | ปฏิเสธ |

บันทึกผลจริงต่อท้ายไฟล์นี้: ขั้น | ผล | ข้อความจริง | `git status`
