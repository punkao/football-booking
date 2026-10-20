# MUTANTS — ทำพังเองเพื่อวัดตาข่าย (chunk D-2 · แผน L4 · บท 06 LAB 5 ส่วนที่ 3)

ทำเมื่อ 2026-10-20 · แก้ทีละตัว 1 บรรทัด → rebuild (`BUG_MODE=0 MODE=mock ALLOW_TEST_RESET=1 docker compose -f web/compose.yaml up -d --build --wait` · 38 วินาที/ครั้ง) → `node tests/golden/check.mjs` → e2e ไฟล์ที่เกี่ยวบน chromium (`--no-deps`) → จดผล → `git checkout -- <ไฟล์>` → ตัวถัดไป
**ห้าม commit โค้ดที่ทำพัง** · log เต็มอยู่ใน scratchpad ของ session (ไม่เก็บใน repo)

## ผล

| mutant | ไฟล์:บรรทัด | เปลี่ยน | จับได้โดย | ไม่จับ (รอด) | ผล |
|---|---|---|---|---|---|
| M1 ราคาเย็นเริ่ม 17 → 18 | `web/lib/rules/pricing.ts:4` | `EVENING_START_HOUR = 17` → `18` | golden quote **ต่าง 85/261** (ชั่วโมง 17 วันธรรมดาเป็นราคากลางวัน · `freeHourSlot` 17:00 กลายเป็น true · ศ 17:00 ไม่เป็น FULL_100) · golden side **ต่าง 3/15** (`availability` ราคาช่อง 17:00 ของ 9/12/16 ต.ค.) · e2e `price.spec.ts` **ล้ม 3/4** (TC-PRICE-01, 03, 04) | golden รายงาน (เงินที่บันทึกแล้วไม่ถูกคิดใหม่ — ถูกต้อง) | ✅ ถูกจับ |
| M2 มัดจำ 50% → 40% | `web/lib/rules/pricing.ts:50` | `plan === "FULL_100" ? 100 : 50` → `: 40` | golden quote **ต่าง 176/261** (`payNow` `dueAtField` ของ DEPOSIT_50 ทุกเคสที่ยอดสุทธิ > 0 · อีก 12 เคส DEPOSIT_50 ยอดสุทธิ ฿0 เพราะเครดิตต้นจ่ายหมด จึงไม่ต่าง) · e2e `price.spec.ts` **ล้ม 2/4** (TC-PRICE-03, 04) | golden side 15/15 เท่าเดิม (availability ไม่มีมัดจำ · รายงานอ่านเงินที่จ่ายแล้วใน seed) | ✅ ถูกจับ |
| M3 จองล่วงหน้า 14 → 13 วัน | `web/lib/rules/schedule.ts:9` | `MAX_ADVANCE_DAYS = 14` → `13` | golden quote **ต่าง 39/261** (36 เคสวันที่ 23 ต.ค. 200 → 400 `TOO_FAR_AHEAD` + 3 เคสวันที่ 24 `params.maxDate` 23 → 22) · golden side **ต่าง 7/15** (`availability.maxDate` ทุกวัน) · e2e `book.spec.ts` **ล้ม 1/6** (TC-BOOK-04 ปุ่มวันที่ 23 ต.ค. หาย) | – | ✅ ถูกจับ |

**สรุป: จับได้ 3/3 · รอด 0** · golden จับทั้ง 3 ตัวในเวลา ~5 วินาที (กว้างกว่า: 39–176 เคส) · e2e ไฟล์เดียวจับทั้ง 3 ตัวแต่ด้วย 1–3 TC และ ~16 วินาที/ไฟล์

## หลังคืนไฟล์

- `git checkout -- web/lib/rules/pricing.ts` (M1, M2) · `git checkout -- web/lib/rules/schedule.ts` (M3) → `git status --short web db` **ว่าง**
- rebuild โค้ดปกติ → `/api/version` = `{"schemaVersion":"006","chatMode":"mock","bugMode":0}` · container healthy
- `node tests/golden/check.mjs` → quote **261/261** `ac43f117` · side **15/15** `a7fba5c2` (เท่ากับก่อนทำ mutant)

## รูของตาข่ายที่เห็นระหว่างทำ (ไม่มี mutant รอด แต่มีจุดที่ "ตาข่ายไม่ได้มอง")

| รู | หลักฐาน | เทสต์ที่ควรเพิ่ม |
|---|---|---|
| ข้อความ error เขียนตัวเลขตายตัว: M3 ทำให้ `maxDate` = 22 ต.ค. แต่ข้อความยังบอก "จองล่วงหน้าได้ไม่เกิน **14** วัน" | diff ของ M3: `"message":"จองล่วงหน้าได้ไม่เกิน 14 วัน","params":{"maxDate":"2026-10-22"}` · ข้อความมาจาก i18n ไม่ได้อ่าน `MAX_ADVANCE_DAYS` | เทสต์ที่ตรวจว่าตัวเลขในข้อความ `TOO_FAR_AHEAD` ตรงกับ `maxDate − today` (ไม่ใช่แค่ตรวจคำว่า "14") |
| ราคา/กฎในแชทเขียนตายตัว ("ก่อน 17:00" · ราคาต่อสนาม) ไม่ผูกกับ `EVENING_START_HOUR` หรือตาราง `fields` | `chat/mock.ts:132-147` (SYSTEM-MAP ส่วน I) · M1 เปลี่ยนราคาเว็บแต่ข้อความบอทยังพูด 17:00 · golden ไม่ได้ยิงแชท | เทสต์เทียบ "ราคาที่บอทตอบ" กับ `/api/quote` ช่องเดียวกัน (สำคัญกับ CR-05 ราคาเปลี่ยนตามวันมีผล) |
| หน้าแรกใช้ `SEED_FIELDS` ไม่อ่าน DB | `web/lib/server/schema.ts:5-9` · golden ล็อกแค่ `/api/availability` และ `/api/quote` | เพิ่มเคสใน golden/e2e ที่เทียบราคาในการ์ดหน้าแรกกับ `GET /api/availability` (CR-05) |
| golden ไม่ครอบ "การจองจริง" (เขียน DB) | golden ยิงแค่ quote / อ่าน · ยอดที่บันทึกใน `bookings` ตอนสร้าง/เลื่อน ไม่ถูกล็อก | golden ชุดเขียน: reset → สร้างการจองตามกริดย่อย → อ่าน `GET /api/bookings/<code>` เทียบ (โดยเฉพาะเลื่อนวันข้าม 1 พ.ย. ของ CR-05) |
