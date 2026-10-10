# Trace · เฟส 3 (Requirements + ออกแบบระบบ) — Graph Template

ใช้ Graph Template จาก `Teaching_CWN2026/01_Basic_AI_WORFLOW/labs/prompts/graph/graph-template.md`
ทำโดย session หลักตามลำดับ Dependency — **จำลองบทบาท ไม่ได้รัน N2–N4 ขนานหรือแยกบริบทจริง** (ระบุตามจริงแบบบทเรียน 2.4)
N2–N4 ใช้เฉพาะ contract ของ N1 + INPUT และไม่อ่านผลของกันและกัน (ทำตามลำดับ N2 → N3 → N4 โดยไม่แก้ node ก่อนหน้า)

## REQUIREMENT

INPUT: `01-INTERVIEW.md` (v3: S01–S44 + A-01–A-14), `02-BA.md`, `03-USER-STORIES.md`
OUTPUT: `04-REQUIREMENTS.md`, `05-SRS.md`, `06-SA.md`, `07-SAD.md`

## CRITERIA (ล็อกก่อนเริ่ม — ห้ามแก้ระหว่างทำ)

- **C1 ครบ:** ทุก US-01–US-34 มี FR หรือ BR รองรับในตาราง US→FR/BR ของ `04` · ทุก FR/BR อ้างที่มา (US / S / A) ที่มีอยู่จริง · `05-SRS` และ `07-SAD` อ้างเฉพาะรหัส FR/BR/NFR ที่มีใน `04` และทุก FR ถูกอ้างใน SRS
- **C2 สอดคล้อง:** ชื่อ entity ใน sequence และ state diagram ของ `06-SA` มีอยู่ใน ERD · ชื่อ entity ใน ERD ตรงกับ contract ใน `04` · ทุกสถานะใน state diagram ตรงกับรายการสถานะใน contract และระบุว่า "อยู่กับใคร"
- **C3 ตรวจได้จริง:** ทุกบล็อก Mermaid ใน `02`–`07` render ได้ใน Chromium (`tools/render-mermaid.mjs`) · BR ทุกข้อมีคอลัมน์ "ค่าขอบที่ต้องทดสอบ" ที่ไม่ว่าง · ตัวเลขกฎใน `04` มาจาก S/A (ตรวจด้วยสคริปต์แบบเฟส 2)

## TASK_GRAPH

| Node | Task | Depends on | Output |
|---|---|---|---|
| N1 | สกัด FR / BR (+ค่าขอบ) / NFR จาก US + S + A · กำหนด **contract**: entity, attribute, สถานะ, ผู้รับผิดชอบสถานะ, ชื่อรหัสที่ทุกเอกสารใช้ร่วมกัน · ตาราง US→FR/BR · เรื่องที่ยังเปิด | – | `04-REQUIREMENTS.md` |
| N1b | (เงื่อนไข) ถ้า N1 พบข้อกำหนดขัดแย้ง: บันทึกประเด็นและหลักฐานโดยไม่เลือกข้าง | N1 | ส่วน "ข้อขัดแย้ง" ใน `04` |
| N2 | SA: use case, ERD, sequence (จอง→จ่าย→เช็กอิน, ยกเลิก/ฝน), state ของการจอง (+ผู้รับผิดชอบ) ตาม contract | N1 | `06-SA.md` |
| N3 | SAD: สถาปัตยกรรม, docker compose, API, ตารางข้อมูล, การออกแบบให้ทดสอบได้, ADR ตาม contract | N1 | `07-SAD.md` |
| N4 | SRS ตาม ISO/IEC/IEEE 29148 แบบย่อ อ้างรหัสจาก `04` ไม่ copy ข้อความกฎซ้ำ | N1 | `05-SRS.md` |
| N5 | รวม: รัน `tools/check-phase3.mjs` + render Mermaid · ตรวจ C1–C3 · แก้จุดเชื่อมต่อแล้วตรวจซ้ำ | N2, N3, N4 | ผลตรวจในไฟล์นี้ |

## Execution Trace

| Node | Dependency | สถานะ | ผลลัพธ์ / ไฟล์ | หมายเหตุ |
|---|---|---|---|---|
| N1 | – | DONE | `04-REQUIREMENTS.md`: contract 13 entity · สถานะ Booking 7 / Challenge 4 · FR-01–FR-31 · BR-01–BR-28 · NFR-01–NFR-14 · US→FR/BR | เปิดใหม่ 2 เรื่อง (Q-15, Q-16) ใช้การอ่านตามตัวอักษร — ไม่ใช่ข้อขัดแย้งระหว่างคำพูด |
| N1b | N1 | SKIPPED | — | CONDITIONAL EDGE ไม่เกิด: ไม่พบคำพูดที่ขัดกัน |
| N2 | N1 | DONE | `06-SA.md`: use case, ERD 13 entity, sequence 2 ภาพ, state `Booking` + `Challenge` (ทุกสถานะมี "อยู่กับ"), activity คิดราคา | ใช้ contract ของ N1 อย่างเดียว |
| N3 | N1 | DONE | `07-SAD.md`: สถาปัตยกรรม 2 container, deployment, 15 หน้า, API, ตาราง 13 ตาราง, ADR-01–ADR-09, testability | ไม่ได้อ่าน `06-SA` |
| N4 | N1 | DONE | `05-SRS.md`: ISO/IEC/IEEE 29148 แบบย่อ อ้าง FR-01–FR-31, BR, NFR · ตาราง FR → กฎ → วิธีตรวจ | ⚠️ **ความอิสระไม่สมบูรณ์:** เขียนหลัง N3 และอ้างชื่อหัวข้อของ `07-SAD` (ส่วนที่ 3–4, ADR-01) — ผิดกติกา "N2–N4 ห้ามเห็นผลของกันและกัน" บางส่วน บันทึกตามจริง |
| N5 | N2, N3, N4 | DONE | ผลตรวจด้านล่าง · `phase3-n5-attempt1.txt` (ครั้งแรก) | ครั้งแรก C2 FAIL 1 จุด → แก้จุดเชื่อมต่อ 1 บรรทัดใน `06-SA` → ตรวจซ้ำผ่าน (ลองใหม่ 1 ครั้งตาม FAILURE HANDLING) |

### Data contract ของแต่ละ node

```json
[
  { "node": "N1", "status": "DONE", "output": "docs/04-REQUIREMENTS.md",
    "assumptions": ["Q-15: free hour allowed on weekday holidays before 17:00 (literal S21)",
                    "Q-16: FULL_100 decided by booking start hour (literal S13)",
                    "team design: code LN-xxxxxx, round up to whole baht, 1 free hour per booking, Thai 10-digit phone"] },
  { "node": "N2", "status": "DONE", "output": "docs/06-SA.md", "assumptions": ["Holiday has no FK; matched by date when pricing"] },
  { "node": "N3", "status": "DONE", "output": "docs/07-SAD.md",
    "assumptions": ["lazy expiry instead of cron (ADR-03)", "advisory lock per field+date (ADR-02)", "BUG_MODE bugs chosen in phase 4, written only in web/BUGS.md"] },
  { "node": "N4", "status": "DONE", "output": "docs/05-SRS.md", "assumptions": ["verification methods are a plan for phase 6-7, not results"] }
]
```

## ผลตรวจโดย N5 (MERGER)

หลักฐาน: `node tools/check-phase3.mjs` · `node tools/render-mermaid.mjs docs/02-BA.md docs/06-SA.md docs/07-SAD.md` · ครั้งแรกเก็บใน `phase3-n5-attempt1.txt`

| เกณฑ์ | ครั้งที่ 1 | ครั้งที่ 2 (สุดท้าย) | หลักฐาน / ตำแหน่ง |
|---|---|---|---|
| C1 ครบ | PASS | PASS | US 34 ตัวมี FR/BR ทุกตัว · FR 31 อ้าง US ที่มีจริง · BR 28 อ้าง S/A ที่มีจริง · SRS/SAD อ้างเฉพาะรหัสที่มี · SRS อ้าง FR ครบ 31 |
| C2 สอดคล้อง | **FAIL** — sequence ใช้คำ "PromptPay" ที่ไม่ใช่ entity ใน ERD | PASS | แก้ `06-SA` บรรทัด sequence เป็น `Payment.method PROMPTPAY` ตาม contract · ERD 13 = contract 13 · state Booking 7 สถานะ / Challenge 4 สถานะ ตรง contract และมี "อยู่กับ" ครบ |
| C3 ตรวจได้จริง | PASS | PASS | BR 28 ข้อมีค่าขอบทุกข้อ · ตัวเลขกฎใน FR/BR มาจาก S/A หรือแสดง `=` · Mermaid 9 บล็อก (02 ×1, 06 ×7, 07 ×1) render ใน Chromium ผ่าน → `docs/diagrams/*.png` |

หมายเหตุครั้งที่ 1: ข้อที่ไม่ผ่านเป็นปัญหาความสอดคล้องจริง (sequence ไม่ได้ใช้ชื่อตาม contract) ไม่ใช่ตัวตรวจผิด จึงแก้ที่เอกสาร และไม่แก้ตัวตรวจ

**STOP CONDITION: N5 = DONE** (Dependency ครบ + ทุกเกณฑ์ PASS)

ข้อจำกัดตามจริง: ทุก node ทำโดย session เดียวตามลำดับ ไม่ได้รันขนานหรือแยกบริบท · N4 เห็นผลของ N3 บางส่วน (ดูตารางด้านบน)
