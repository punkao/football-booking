# SYSTEM-MAP (= CODEBASE-MAP) — แผนที่ระบบ "ลูกหนัง อารีน่า" v2 สำหรับทีมดูแลรายใหม่

ทำเมื่อ 2026-10-20 · tag `v2-handover` = `faa3f2e` · HEAD `95a5513` (ต่างแค่ `CHANGE-REQUESTS/`) · ทำโดยเปิดไฟล์จริงทุกแถว (white-box) + `psql` (ตา DB) + HAR / REA (grey/black-box ดู `API-INVENTORY.md`, `REA-INVENTORY.md`)
กติกา: ทุกแถวมี `ไฟล์:บรรทัด` ที่เปิดดูแล้ว · ไม่มีแถว "เดา" · เรื่องที่ยังไม่รู้อยู่ส่วน K · ตาราง CR → `file:line` อยู่ท้ายไฟล์ (ส่วน L)
path ในตารางเป็นแบบย่อ: `rules/` = `web/lib/rules/` · `server/` = `web/lib/server/` · `chat/` = `web/lib/chat/` · `app/` = `web/app/` · `mig/` = `db/migrations/`

## A. สถาปัตยกรรม (2 compose project · 1 network)

| ส่วน | ค่า | ยืนยันจาก |
|---|---|---|
| ฐานข้อมูล | `postgres:16-alpine` container `football-db` · volume `football-pgdata` · พอร์ต `127.0.0.1:5433` · TZ Asia/Bangkok · mount `init/` `migrations/` `scripts/` `backups/` | `db/compose.yaml:6-24` |
| network | `football-net` สร้างโดย db project · web ใช้แบบ `external` | `db/compose.yaml:32-34` · `web/compose.yaml` ท้ายไฟล์ `external: true` |
| เว็บ | image `football-web:v2` · container `football-web` · พอร์ต 3000 · ไม่มี volume ข้อมูล · mount `docs/` `e2e/test-report/` (Portal) และ `db/init/02-seed.sql` (reset) อ่านอย่างเดียว | `web/compose.yaml:9-38` |
| env ที่มีผล | `DATABASE_URL` (บังคับ) · `ALLOW_TEST_RESET` (ค่าเริ่ม 0) · `BUG_MODE` (0) · `MODE` (mock) · `LLM_BASE_URL` `LLM_MODEL` `LLM_API_KEY` `LLM_TIMEOUT_MS` · `SESSION_SECRET` · `SEED_SQL_PATH` | `web/compose.yaml:15-27` |
| healthcheck เว็บ | `fetch('http://127.0.0.1:3000/api/health')` ต้อง `ok && db` | `web/compose.yaml:33-34` |
| mock-llm | profile `mock` · node:24 · mount `web/lib` อ่านอย่างเดียว → ใช้สมองเดียวกับ `MODE=mock` | `web/compose.yaml` service `mock-llm` · `web/mock-llm/server.mjs:11` |
| เริ่มเว็บ | `instrumentation.ts` ตรวจ `SESSION_SECRET` (ไม่ผ่าน → `process.exit(1)`) แล้วรอ DB | `web/instrumentation.ts:4-17` · `server/secret.ts:14-34` |
| สร้าง schema | `db/init/01-schema.sql` `\ir` migration 001–006 ตอนสร้าง volume ครั้งแรก (web ไม่สร้างตาราง) | `db/init/01-schema.sql:4-10` · `server/db.ts:23-47` |
| ชั้นของโค้ด | หน้า (`app/**/page.tsx` server component) → client component (`*Client.tsx`) เรียก `api()` → route (`app/api/**/route.ts`) ห่อด้วย `route()` → `server/*.ts` → `rules/*.ts` (pure) + SQL ผ่าน `q()` / `tx()` | `web/lib/client.ts:8-30` · `server/core.ts:81-105` · `server/db.ts:49-77` |
| `route()` ทำอะไรทุกคำขอ | อ่าน cookie `lang` · ตรวจ Origin (CSRF) · อ่าน "ตอนนี้" (`getNow`) · หมดเวลาจ่ายแบบ lazy (`expireStale`) · แปลง `AppError` / error ของ DB → `{ error: { code, message } }` | `server/core.ts:81-105` · `server/core.ts:32-58` |
| ตัวนับ | หน้า 32 ไฟล์ `page.tsx` · route 55 ไฟล์ (`app/api`) + 1 (`app/project/files`) · handler 80 = ใช้งาน 60 + ตอบ 404 ตั้งใจ 20 | `find web/app -name page.tsx` · `grep "^export (const|async function) (GET|POST|…)"` |

## B. หน้าเว็บ (32)

| path | ไฟล์ | client component | สิทธิ์ (ยืนยันจาก) | API ที่หน้าเรียก (ไฟล์:บรรทัด) |
|---|---|---|---|---|
| `/` | `app/page.tsx` | – (server) | ทุกคน | ไม่มี · **ราคาการ์ดสนามมาจากค่าคงที่ `SEED_FIELDS`** `app/page.tsx:4,67,85` ← `server/schema.ts:5-9` |
| `/book` | `app/book/page.tsx` | `BookClient` | ทุกคน | `GET /api/availability` `app/book/BookClient.tsx:34` |
| `/book/new` | `app/book/new/page.tsx` | `NewBookingClient` | ทุกคน (สมาชิกเติมให้ `pageCustomer` `:8`) | `POST /api/quote` `NewBookingClient.tsx:82` · `GET /api/rentals/availability` `:96` · `POST /api/bookings` `:112` |
| `/pay/[code]` | `app/pay/[code]/page.tsx` | `PayClient` | เจ้าของการจอง | `GET /api/bookings/{code}` `PayClient.tsx:31` · `POST …/pay` `:55` |
| `/booking/[code]` | `app/booking/[code]/page.tsx` | `BookingClient` (+ `PhoneGate`) | เจ้าของ / cookie `ln_access` / เบอร์ | `GET /api/bookings/{code}` `BookingClient.tsx:73` · `POST …/{cancel,reschedule,split}` `:93` · `POST /api/challenges` `:105` · timeline `:159-180` · `components/PhoneGate.tsx:21` |
| `/my` | `app/my/page.tsx` | `MyClient` | ทุกคน | `GET /api/me` `MyClient.tsx:40` · login `:60` · register `:68` · ค้นรหัส+เบอร์ `:77` · logout `:83` |
| `/series` | `app/series/page.tsx` | `SeriesClient` | สมาชิก | preview `SeriesClient.tsx:37` · create `:48` |
| `/split/[token]` | `app/split/[token]/page.tsx` | `SplitClient` | ผู้มีลิงก์ | `SplitClient.tsx:24` · paid `:37` |
| `/challenges` | `app/challenges/page.tsx` | `ChallengesClient` | ทุกคน | list `ChallengesClient.tsx:25` · accept `:46` · pay `:62` |
| `/fields` | `app/fields/page.tsx` | – (server · อ่าน DB) | ทุกคน | ไม่มี (ราคาจาก `fields` · `app/fields/page.tsx:44-51`) |
| `/staff/login` | `app/staff/login/page.tsx` | `StaffLoginClient` | ทุกคน | login `StaffLoginClient.tsx:21` · logout `:32` |
| `/staff` | `app/staff/page.tsx` | `StaffClient` | STAFF MANAGER OWNER `app/staff/page.tsx:8` | ค้น `StaffClient.tsx:44` · checkin/no-show/return `:67` · logout `:76` |
| `/staff/today` | `app/staff/today/page.tsx` | `TodayClient` | MANAGER OWNER `:8` | `TodayClient.tsx:27` |
| `/staff/stock` | `app/staff/stock/page.tsx` | `StockClient` | STAFF+ `:8` | `StockClient.tsx:25-26` |
| `/staff/stock/sale` | `app/staff/stock/sale/page.tsx` | `SaleClient` | STAFF+ `:8` | `SaleClient.tsx:30` |
| `/staff/stock/transfer` | `app/staff/stock/transfer/page.tsx` | `TransferClient` | STAFF+ `:8` | `TransferClient.tsx:26` |
| `/manager/stock` | `app/manager/stock/page.tsx` | `ManagerStockClient` | MANAGER OWNER `:8` | `ManagerStockClient.tsx:44,86,110,134,166` |
| `/owner` | `app/owner/page.tsx` | `OwnerClient` | OWNER `:8` | holidays/closures `OwnerClient.tsx:25,72,85,114` |
| `/owner/dashboard` | `app/owner/dashboard/page.tsx` | `DashboardClient` | OWNER MANAGER `:8` | `DashboardClient.tsx:57` |
| `/owner/bookings` | `app/owner/bookings/page.tsx` | `BookingsClient` | OWNER MANAGER `:8` | `BookingsClient.tsx:17` |
| `/owner/bookings/[code]` | `app/owner/bookings/[code]/page.tsx` | `BookingHistoryClient` | OWNER MANAGER `:9` | `BookingHistoryClient.tsx:17` · แสดงผู้ทำ `:73-74` |
| `/owner/reports` | `app/owner/reports/page.tsx` | `ReportsClient` | OWNER `:8` | `ReportsClient.tsx:40` · ลิงก์ CSV `:83` · คอลัมน์ `:105-119` |
| `/owner/chats` · `/owner/chats/[id]` | `app/owner/chats/page.tsx` · `[id]/page.tsx` | `ChatsClient` · `ChatDetailClient` | OWNER MANAGER `:8` · `:9` | `ChatsClient.tsx:14` · `ChatDetailClient.tsx:16` |
| `/owner/audit` | `app/owner/audit/page.tsx` | `AuditClient` | OWNER `:8` | `AuditClient.tsx:19` |
| `/project` + 7 หน้าย่อย | `app/project/**/page.tsx` | `TestcasesClient` | ทุกคน (Portal ของงาน) | อ่านไฟล์จาก mount `server/project.ts:7-11` · `app/project/files/[...path]/route.ts:15` |
| ปุ่มแชทลอย (ทุกหน้าลูกค้า) | `components/ChatWidget.tsx` | – | ทุกคน | `GET /api/chat` `:156` · `POST /api/chat` `:176` · `POST /api/chat/book` `:48` |

กลไกกันหน้า: `requireStaffPage()` ไม่มี session → redirect `/staff/login?next=` · บทบาทไม่พอ → `allowed:false` แสดง Forbidden (`server/page.ts:27-31`)

## C. API route (60 handler ที่ใช้งาน)

สิทธิ์: `public` = ไม่ต้องเข้าสู่ระบบ · `cookie` = ผูก cookie ของตัวเอง · STAFF+ = `requireStaff` (`server/core.ts:150-155`) · MGR+ = MANAGER/OWNER · area = `canAccess` (`rules/reports.ts:31-35`)

| # | method | path | route ไฟล์:บรรทัด | ฟังก์ชัน server (ไฟล์:บรรทัด) | ผู้เรียกในเว็บ (ไฟล์:บรรทัด) | สิทธิ์ |
|---|---|---|---|---|---|---|
| 1 | GET | `/api/availability` | `availability/route.ts:6` | `availability` `server/features.ts:67` | `BookClient.tsx:34` · บอท `server/chat.ts:77` | public |
| 2 | POST | `/api/quote` | `quote/route.ts:6` | `quote` `server/bookings.ts:169` → `evaluateBooking` `:99` | `NewBookingClient.tsx:82` | public |
| 3 | POST | `/api/bookings` | `bookings/route.ts:8` | `createBooking` `server/bookings.ts:227` + `withAccess` `server/access.ts:7` | `NewBookingClient.tsx:112` | public |
| 4 | GET | `/api/bookings/{code}` | `bookings/[code]/route.ts:8` | `authorizeBooking` `server/bookings.ts:291` · `bookingDetail` `:327` | `BookingClient.tsx:73` · `PayClient.tsx:31` · `MyClient.tsx:77` · `PhoneGate.tsx:21` | เจ้าของ / `ln_access` / `?phone=` |
| 5 | POST | `/api/bookings/{code}/pay` | `…/pay/route.ts:6` | `payBooking` `server/bookings.ts:420` | `PayClient.tsx:55` | เหมือน 4 |
| 6 | POST | `/api/bookings/{code}/cancel` | `…/cancel/route.ts:6` | `cancelBooking` `server/bookings.ts:443` | `BookingClient.tsx:93` | เหมือน 4 |
| 7 | POST | `/api/bookings/{code}/reschedule` | `…/reschedule/route.ts:6` | `rescheduleBooking` `server/bookings.ts:475` | `BookingClient.tsx:93` | เหมือน 4 |
| 8 | POST | `/api/bookings/{code}/split` | `…/split/route.ts:6` | `splitCreate` `server/features.ts:234` | `BookingClient.tsx:93` | เหมือน 4 |
| 9 | GET | `/api/split/{token}` | `split/[token]/route.ts:6` | `splitGet` `server/features.ts:269` | `SplitClient.tsx:24` | ผู้มีลิงก์ |
| 10 | POST | `/api/split/{token}/{shareId}/paid` | `…/paid/route.ts:6` | `splitMarkPaid` `server/features.ts:296` | `SplitClient.tsx:37` | ผู้มีลิงก์ |
| 11 | GET | `/api/challenges` | `challenges/route.ts:6` | `challengeList` `server/features.ts:307` | `ChallengesClient.tsx:25` | public |
| 12 | POST | `/api/challenges` | `challenges/route.ts:7` | `challengeCreate` `server/features.ts:341` | `BookingClient.tsx:105` | เจ้าของการจอง |
| 13 | POST | `/api/challenges/{id}/accept` | `…/accept/route.ts:6` | `challengeAccept` `server/features.ts:372` | `ChallengesClient.tsx:46` | public |
| 14 | POST | `/api/challenges/{id}/pay` | `…/pay/route.ts:6` | `challengePay` `server/features.ts:390` | `ChallengesClient.tsx:62` | เบอร์ผู้รับ |
| 15 | POST | `/api/customers/register` | `customers/register/route.ts:6` | `register` `server/auth.ts:11` | `MyClient.tsx:68` | public |
| 16 | POST | `/api/customers/login` | `customers/login/route.ts:6` | `customerLogin` `server/auth.ts:31` (cookie `ln_customer` = `sign({cid})` อายุ 30 วัน `:36`) | `MyClient.tsx:60` | public |
| 17 | POST | `/api/customers/logout` | `customers/logout/route.ts:5-9` | ในไฟล์: ตั้ง cookie ว่าง `maxAge 0` เท่านั้น | `MyClient.tsx:83` | – |
| 18 | GET | `/api/me` | `me/route.ts:6` | `me` `server/features.ts:99` | `MyClient.tsx:40` | cookie `ln_customer` |
| 19 | POST | `/api/series/preview` | `series/preview/route.ts:6` | `seriesPreview` `server/features.ts:184` | `SeriesClient.tsx:37` | สมาชิก |
| 20 | POST | `/api/series` | `series/route.ts:9` | `seriesCreate` `server/features.ts:191` | `SeriesClient.tsx:48` | สมาชิก |
| 21 | GET | `/api/rentals/availability` | `rentals/availability/route.ts:6` | `rentalsAvailability` `server/features.ts:226` → `rentalAvailability` `server/bookings.ts:70` | `NewBookingClient.tsx:96` | public |
| 22 | POST | `/api/chat` | `chat/route.ts:6` | `chatSend` `server/chat.ts:160` | `ChatWidget.tsx:176` | cookie `ln_chat` |
| 23 | GET | `/api/chat` | `chat/route.ts:7` | `chatHistory` `server/chat.ts:220` | `ChatWidget.tsx:156` | cookie `ln_chat` |
| 24 | GET | `/api/chat/{sessionId}` | `chat/[sessionId]/route.ts:6` | `chatHistory` `server/chat.ts:220` | **ไม่มีหน้าเรียก** (e2e `tests/chat-helpers.ts`) | ห้องของ cookie |
| 25 | POST | `/api/chat/book` | `chat/book/route.ts:6` | `chatBook` `server/chat.ts:237` | `ChatWidget.tsx:48` | cookie `ln_chat` + draftToken |
| 26 | POST | `/api/staff/login` | `staff/login/route.ts:6` | `staffLogin` `server/auth.ts:41` (cookie `ln_staff` = `sign({sid})` 12 ชม. `:51`) | `StaffLoginClient.tsx:21` | public |
| 27 | POST | `/api/staff/logout` | `staff/logout/route.ts:5-9` | ในไฟล์: ตั้ง cookie ว่างเท่านั้น | `StaffLoginClient.tsx:32` · `StaffClient.tsx:76` | – |
| 28 | GET | `/api/staff/me` | `staff/me/route.ts:4-8` | `staffFrom` `server/core.ts:143` | **ไม่มีหน้าเรียก** | cookie `ln_staff` |
| 29 | GET | `/api/staff/bookings/{code}` | `staff/bookings/[code]/route.ts:6` | `staffGet` `server/features.ts:436` → `staffBookingView` `:417` | `StaffClient.tsx:44` | STAFF+ |
| 30 | POST | `…/{code}/checkin` | `…/checkin/route.ts:6` | `staffCheckin` `server/features.ts:441` | `StaffClient.tsx:67` | STAFF+ |
| 31 | POST | `…/{code}/no-show` | `…/no-show/route.ts:6` | `staffNoShow` `server/features.ts:461` | `StaffClient.tsx:67` | STAFF+ |
| 32 | POST | `…/{code}/return-rentals` | `…/return-rentals/route.ts:6` | `staffReturn` `server/features.ts:487` | `StaffClient.tsx:67` | STAFF+ |
| 33 | GET | `/api/staff/today` | `staff/today/route.ts:6` | `staffToday` `server/features.ts:507` | `TodayClient.tsx:27` | MGR+ |
| 34 | GET | `/api/staff/stock` | `staff/stock/route.ts:6` | `stockOverview` `server/stock.ts:94` | `StockClient.tsx:25` · `ManagerStockClient.tsx:44` | STAFF+ |
| 35 | GET | `/api/staff/stock/movements` | `…/movements/route.ts:6` | `stockMovements` `server/stock.ts:134` | `StockClient.tsx:26` | STAFF+ |
| 36 | POST | `/api/staff/stock/sale` | `…/sale/route.ts:6` | `counterSale` `server/stock.ts:186` | `SaleClient.tsx:30` | STAFF+ |
| 37 | POST | `/api/staff/stock/transfer` | `…/transfer/route.ts:6` | `stockTransfer` `server/stock.ts:227` | `TransferClient.tsx:26` | STAFF+ |
| 38 | POST | `/api/manager/stock/receive` | `manager/stock/receive/route.ts:6` | `stockReceive` `server/stock.ts:246` | `ManagerStockClient.tsx:86` | MGR+ (`canStockAction` `rules/stock.ts:41`) |
| 39 | POST | `/api/manager/stock/damage` | `…/damage/route.ts:6` | `stockDamage` `server/stock.ts:263` | `ManagerStockClient.tsx:110` | MGR+ |
| 40 | POST | `/api/manager/stock/adjust` | `…/adjust/route.ts:6` | `stockAdjust` `server/stock.ts:283` | `ManagerStockClient.tsx:134` | MGR+ |
| 41 | PUT | `/api/manager/stock/items/{itemId}/reorder-point` | `…/reorder-point/route.ts:6` | `stockReorderPoint` `server/stock.ts:312` | `ManagerStockClient.tsx:166` | MGR+ |
| 42 | GET | `/api/manager/stock/alerts` | `…/alerts/route.ts:6` | `stockAlerts` `server/stock.ts:126` | **ไม่มีหน้าเรียก** (หน้า stock ใช้ `alerts` ใน #34) | MGR+ |
| 43 | GET | `/api/owner/dashboard` | `owner/dashboard/route.ts:6` | `dashboard` `server/backoffice.ts:67` | `DashboardClient.tsx:57` | area DASHBOARD |
| 44 | GET | `/api/owner/bookings` | `owner/bookings/route.ts:6` | `bookingsSearch` `server/backoffice.ts:102` | `BookingsClient.tsx:17` | area BOOKINGS |
| 45 | GET | `/api/owner/bookings/{code}/history` | `…/history/route.ts:7` | `bookingHistory` `server/backoffice.ts:146` | `BookingHistoryClient.tsx:17` | area BOOKINGS |
| 46 | GET | `/api/owner/reports` | `owner/reports/route.ts:6` | `report` `server/backoffice.ts:174` | `ReportsClient.tsx:40` | OWNER |
| 47 | GET | `/api/owner/reports.csv` | `owner/reports.csv/route.ts:6` | `reportCsv` `server/backoffice.ts:228` | `ReportsClient.tsx:83` (ลิงก์ดาวน์โหลด) | OWNER |
| 48 | GET | `/api/owner/chats` | `owner/chats/route.ts:6` | `chatsList` `server/backoffice.ts:307` | `ChatsClient.tsx:14` | area CHATS |
| 49 | GET | `/api/owner/chats/{ref}` | `owner/chats/[id]/route.ts:7` | `chatDetail` `server/backoffice.ts:345` | `ChatDetailClient.tsx:16` | area CHATS |
| 50 | GET | `/api/owner/audit` | `owner/audit/route.ts:7` | `auditList` `server/backoffice.ts:365` | `AuditClient.tsx:19` | OWNER |
| 51 | GET | `/api/owner/holidays` | `owner/holidays/route.ts:6` | `holidaysList` `server/features.ts:553` | `OwnerClient.tsx:25` | OWNER |
| 52 | POST | `/api/owner/holidays` | `owner/holidays/route.ts:7` | `holidayAdd` `server/features.ts:558` | `OwnerClient.tsx:85` | OWNER |
| 53 | DELETE | `/api/owner/holidays?date=` | `owner/holidays/route.ts:8` | `holidayDelete` `server/features.ts:572` | `OwnerClient.tsx:72` | OWNER |
| 54 | GET | `/api/owner/closures` | `owner/closures/route.ts:6` | `closuresList` `server/features.ts:582` | `OwnerClient.tsx:25` | OWNER |
| 55 | POST | `/api/owner/closures` | `owner/closures/route.ts:7` | `closureCreate` `server/features.ts:588` | `OwnerClient.tsx:114` | OWNER |
| 56 | GET | `/api/fields` | `fields/route.ts:6` | `loadFields` `server/data.ts:59` | **ไม่มีหน้าเรียก** (e2e `tests/api.spec.ts`) | public |
| 57 | GET | `/api/health` | `health/route.ts:6-13` | ในไฟล์ `q("SELECT 1")` | healthcheck `web/compose.yaml:34` | public |
| 58 | GET | `/api/version` | `version/route.ts:7-18` | ในไฟล์ `max(version)` จาก `schema_migrations` | **ไม่มีหน้าเรียก** (ops) | public |
| 59 | POST | `/api/test/reset` | `test/reset/route.ts:6` | `testEndpoint` `server/testing.ts:22` | seam: selfcheck · e2e global-setup | `ALLOW_TEST_RESET=1` |
| 60 | POST | `/api/test/clock` | `test/clock/route.ts:6` | `testEndpoint` `server/testing.ts:22` | seam | `ALLOW_TEST_RESET=1` |

handler 404 ตั้งใจ 20 ตัว (`testNotFound` `server/testing.ts:17-19`): `owner/audit` POST/PUT/PATCH/DELETE `route.ts:11-14` · `owner/bookings/{code}/history` `:8-11` · `owner/chats/{id}` `:8-11` · `test/reset` GET/PUT/PATCH/DELETE `:11-14` · `test/clock` `:11-14`

## D. โมดูลฝั่ง server

| ไฟล์ | หน้าที่ | ฟังก์ชันสำคัญ (บรรทัด) |
|---|---|---|
| `server/core.ts` | ตัวห่อ route · AppError · "ตอนนี้" · lazy expiry · session cookie | `route` 81 · `getNow` 32 · `expireStale` 41 · `customerIdFrom` 133 · `accessCodesFrom` 137 · `staffFrom` 143 · `requireStaff` 150 · `cookieOpts` (30 วัน) 157 |
| `server/crypto.ts` | scrypt รหัสผ่าน · cookie แบบเซ็น HMAC (ไม่มีวันหมดอายุในตัว ไม่มี session id) · draft token · HMAC ref | `hashPassword` 5 · `verifyPassword` 11 · `sign` 21 · `unsign` 27 · `signDraft` 43 · `chatRef` 54 · `ipRef` 59 |
| `server/secret.ts` | เลือก `SESSION_SECRET` (≥ 32 · ห้ามค่าเก่าสาธารณะ · test machine สุ่มให้) | `resolveSessionSecret` 14 · `sessionSecret` 27 |
| `server/auth.ts` | สมัคร / login ลูกค้า / login ร้าน | `register` 11 · `customerLogin` 31 · `staffLogin` 41 |
| `server/access.ts` | cookie `ln_access` จำรหัสการจองที่เบราว์เซอร์นี้สร้าง/ปลดล็อก (สูงสุด 40) | `withAccess` 7 |
| `server/db.ts` | pool `pg` · `q` · `tx(fn, {actor, now})` ตั้ง `app.actor`/`app.now` · audit · advisory lock | `pool` 15 · `q` 49 · `tx` 62 · `setActor` 80 · `audit` 85 · `lockKey` 103 |
| `server/data.ts` | อ่านตาราง + map camelCase | `loadFields` 59 · `loadRentalItems` 74 (BR-38 รวม stock ด้วย SQL) · `upsertCustomer` 90 · `loadBookingByCode` 107 · `mapBookingPublic` 139 |
| `server/bookings.ts` | จอง / ราคา / จ่าย / ยกเลิก / เลื่อน | `rentalAvailability` 70 · `evaluateBooking` 99 · `quote` 169 · `confirmBooking` 201 · `createBooking` 227 · `authorizeBooking` 291 · `bookingDetail` 327 (history 353-354, 400) · `payBooking` 420 · `cancelBooking` 443 · `rescheduleBooking` 475 |
| `server/features.ts` | ตารางว่าง · me · จองประจำ · หาร · คำท้า · งานพนักงาน · วันหยุด · ปิดฝน | `availability` 67 · `me` 99 · `seriesPlan` 134 · `seriesCreate` 191 · `staffBookingView` 417 · `staffCheckin` 441 · `staffNoShow` 461 · `staffToday` 507 · `closureCreate` 588 |
| `server/backoffice.ts` | แดชบอร์ด · ค้นการจอง + ประวัติ · รายงาน + CSV · แชท · audit · ลบเบอร์ 90 วัน | `moneyRows` 42 · `creditUsedByDay` 57 · `dashboard` 67 · `bookingsSearch` 102 · `bookingHistory` 146 · `report` 174 · `reportCsv` 228 · `redactOldChats` 263 · `auditList` 365 |
| `server/stock.ts` | คลัง (ขาย ย้าย รับ ชำรุด ปรับ จุดสั่งซื้อ) | `requireStock` 30 · `checkRentalTotal` 72 · `stockOverview` 94 · `counterSale` 186 · `stockAdjust` 283 |
| `server/chat.ts` | แชทบอท: เลือกสมอง · เครื่องมือ · prompt · จำกัดอัตรา · จองจากการ์ด | `callModel` 42 · `toolsFor` 65 · `systemPrompt` 119 · `clientIp` 140 · `chatSend` 160 · `chatHistory` 220 · `chatBook` 237 |
| `server/testing.ts` | seam reset / clock | `seedPath` 12 · `testNotFound` 17 · `testEndpoint` 22 |
| `server/page.ts` | helper ของ server component | `pageCustomer` 14 · `pageStaff` 20 · `requireStaffPage` 27 · `pageNow` 33 |
| `server/schema.ts` | ค่าคงที่สนาม 3 แถวสำหรับหน้าแรก (ไม่อ่าน DB) | `SEED_FIELDS` 5-9 |
| `server/project.ts` · `markdown.ts` | Portal `/project` อ่าน `docs/` `e2e/test-report/` | `PROJECT_ROOT` 7 · `safeResolve` 27 · `renderMarkdown` (`markdown.ts:55`) |
| `web/lib/client.ts` | `api()` ฝั่งเบราว์เซอร์ · คำตอบที่ไม่ใช่ JSON → แสดง `INTERNAL` "เกิดข้อผิดพลาดในระบบ" | `api` 8 · fallback `INTERNAL` 24 |
| `web/lib/i18n.ts` | ข้อความ TH/EN ทุก error · ป้ายสถานะ · เงิน | `MESSAGES` 14 (`INTERNAL` 80 · `OK_CHECKED_IN` 119) · `msg` 137 · `money` 145 · `STATUS_LABEL` 186 |

## E. กฎร้าน (`web/lib/rules` · pure function) → ใครเรียก

| กฎ (ภาษาคน) | ค่าคงที่ / ฟังก์ชัน (ไฟล์:บรรทัด) | ถูกเรียกจาก (ไฟล์:บรรทัด) | ที่พูดกฎเดียวกันซ้ำ |
|---|---|---|---|
| BR-02/03 เริ่ม 08–23 จบ ≤ 24 | `OPEN_HOUR` `LAST_START_HOUR` `CLOSE_HOUR` `rules/schedule.ts:6-8` · `checkStartHour` 20 · `checkHours` 28 | `validateBookingTime` `rules/schedule.ts:78` ← `server/bookings.ts:121` | DB `bookings_hours_check` `mig/005_constraints.sql:35` · prompt `chat/prompt.ts:62` |
| BR-04 จองล่วงหน้า ≤ 14 วัน | `MAX_ADVANCE_DAYS` `rules/schedule.ts:9` · `checkAdvanceWindow` 35 · `maxBookableDate` 43 (BUG_MODE +1 วัน `:44`) | `rules/schedule.ts:84` | prompt `chat/prompt.ts:49,62` |
| BR-05 ห่างจากตอนนี้ ≥ 60 นาที | `MIN_LEAD_MINUTES` `rules/schedule.ts:10` · `checkLeadTime` 48 | `rules/schedule.ts:78-91` · `server/features.ts:146` | prompt `chat/prompt.ts:62` |
| BR-06 ห้ามจองทับ | `BLOCKING_STATUSES` `rules/schedule.ts:13` · `checkNoOverlap` 61 · `overlaps` 54 | `server/bookings.ts:126` · `server/features.ts:154` · ตาราง `:78` | DB `bookings_no_overlap` `mig/005_constraints.sql:77-81` · lock `server/bookings.ts:236` · `dbErrorCode` 23P01→`SLOT_TAKEN` `rules/records.ts:54-58` |
| BR-07/08 ราคาต่อชั่วโมง (ก่อน/หลัง 17:00 · เสาร์อาทิตย์วันหยุด = เย็น) | `EVENING_START_HOUR` `rules/pricing.ts:4` · `hourlyRate` 28 · `isEveningPricedDay` 23 | `server/bookings.ts:148,160,508` · `server/features.ts:82` | **ราคามาจากคอลัมน์ `fields.day_rate/evening_rate`** `mig/001_v1_baseline.sql:14-17` · `SEED_FIELDS` `server/schema.ts:5-9` (หน้าแรก) · prompt `chat/prompt.ts:55` · `rateLines` `chat/mock.ts:132-141` · price guard `chat/engine.ts:68` |
| BR-09 คิดทีละชั่วโมง | `fieldPriceFor` `rules/pricing.ts:34` | `server/bookings.ts:142,509` · `server/chat.ts:95` · `server/features.ts:160` | – |
| BR-10 จ่ายใน 15 นาที | `PAY_WINDOW_MINUTES` `rules/booking.ts:15` · `payDeadlineFrom` 17 · `isPaymentInTime` 22 | `server/bookings.ts:273,426` · `server/features.ts:218` · lazy expiry `server/core.ts:41-58` | prompt `chat/prompt.ts:62` |
| BR-11 จ่ายเต็มเมื่อเริ่ม ≥ 17:00 ศุกร์/เสาร์ | `paymentPlanFor` `rules/pricing.ts:42` | `server/bookings.ts:158` · `server/chat.ts:96` · `server/features.ts:161` | prompt `chat/prompt.ts:63` |
| BR-12 ยอดรวม/จ่ายตอนนี้ (ปัดขึ้น) | `computePrice` `rules/pricing.ts:81` · `ceilBaht` 8 | `server/bookings.ts:158` · `server/chat.ts:96` | DB `bookings_money_check` `mig/005_constraints.sql:36-37` |
| BR-13 ยกเลิก (ถึงก่อนเริ่ม 1 นาที · ≥ 24 ชม. ได้เครดิต) | `checkCancel` `rules/booking.ts:33` · `cancelCredit` 41 | `server/bookings.ts:361,449,453` | – |
| BR-14/15 ปิดฝนคืนเครดิต · เครดิต ≤ ยอด | `rainCreditSplit` `rules/booking.ts:57` · `checkCredit` `rules/pricing.ts:111` | `server/features.ts:631` · `server/bookings.ts:156` | DB `field_closures_field_check` (A,B) `mig/005_constraints.sql:46` |
| BR-16/17 ไม่มา · ระงับ 30 วัน | `checkNoShow` `rules/booking.ts:73` · `banAfterNoShow` 83 · `isBanned` 92 | `server/features.ts:423,465,469` · `server/bookings.ts:137` | – |
| BR-18–21 จองประจำ 4–12 สัปดาห์ · ≥ 8 ลด 10% | `rules/extras.ts:9-12` · `checkSeriesWeeks` 15 · `seriesQuote` 37 · `discountAmount` 32 | `server/features.ts:140,165` | DB `recurring_series_weeks_check` `mig/005_constraints.sql:52` · prompt `chat/prompt.ts:65` · `discountsText` `chat/mock.ts:143-147` |
| BR-22/38 ของเช่าคงเหลือ | `rentalRemaining` `rules/extras.ts:70` · `checkRentalQty` 84 · `rentableTotal` `rules/stock.ts:76` (**ไม่มีผู้เรียก** · ทำซ้ำด้วย SQL `server/data.ts:74-79`) | `server/bookings.ts:74,133` | ราคาเช่าเขียนตายใน `chat/mock.ts:240-241` · `chat/prompt.ts:41-44` (ค่าเริ่ม) |
| BR-23 ชั่วโมงสะสม (นับตอนเช็กอิน) · ทุก 10 ได้ฟรี 1 | `countedHours` `rules/extras.ts:104` · `freeHoursAvailable` 94 · `HOURS_PER_FREE_HOUR` 91 | `server/features.ts:453` (เช็กอิน) · `:117` | – |
| BR-24 ชั่วโมงฟรีใช้ก่อน 17:00 จ–ศ | `isFreeHourSlot` `rules/extras.ts:109` · `checkFreeHour` 115 | `server/bookings.ts:147` | `discountsText` `chat/mock.ts:146` |
| BR-25 เลื่อน 1 ครั้ง ≥ 24 ชม. | `checkReschedule` `rules/booking.ts:104` · `rescheduleSettlement` `rules/records.ts:94` | `server/bookings.ts:362,483,514` | – |
| BR-26 เบอร์ 10 หลัก · 1 ลูกค้าต่อเบอร์ | `normalizePhone` `rules/booking.ts:127` · `checkPhone` 132 | `server/auth.ts:13,32` · `server/bookings.ts:229,295` | DB `customers_phone_key` |
| BR-27 หาร 2–30 คน | `checkSplitCount` `rules/extras.ts:126` · `splitPerPerson` 132 | `server/features.ts:256-261` | – |
| BR-28 คำท้า | `checkChallengeCreate` `rules/extras.ts:141` · `challengeAmount` 152 | `server/features.ts:346,353,376` · `server/bookings.ts:413,531` | DB `challenges_*_check` `mig/005_constraints.sql:56-58` |
| BR-29–32 แชทบอท (ห้ามแต่งราคา · tag · ห้ามยกเลิก) | `rules/chat.ts:7-21` · `parseBotReply` 68 · `neutralizeUserText` 107 · `validateTag` 119 · `priceGuardOk` 147 | `chat/engine.ts:70,82,100` · `server/chat.ts:197` | prompt `chat/prompt.ts:58-68` · `chat/mock.ts:112-123` |
| NFR-16/17 แชท ≤ 500 ตัว · 20/นาที · IP | `checkChatText` `rules/chat.ts:23` · `chatRateOk` 30 · `chatIpLimitOk` 36 | `server/chat.ts:161,176,183` | – |
| BR-33–37 คลัง | `rules/stock.ts:16-71` (`checkStockOut` 16 · `checkTransfer` 23 · `isBelowReorder` 35 · `canStockAction` 41 · `checkReason` 47 · `saleTotal` 66) | `server/stock.ts:32,203-209,235,266,285` · `server/backoffice.ts:97` | DB `stock_levels_qty_check` `mig/003_stock.sql:25` · `stock_movements_*` `:58-66` |
| BR-39 รายงาน ≤ 3 เดือนปฏิทิน | `REPORT_MAX_MONTHS` `rules/reports.ts:7` · `addMonths` 11 · `checkReportRange` 21-26 (`to >= addMonths(from, 3)` → ผิด) | `server/backoffice.ts:176` | ข้อความ `REPORT_RANGE_TOO_LONG` `web/lib/i18n.ts:97` |
| BR-40 เงินนับตามวันรับเงิน | `summarizeMoney` `rules/reports.ts:50` (BUG_MODE ตัดวันสุดท้าย `:57`) | `server/backoffice.ts:72,180` | SQL `moneyRows` `server/backoffice.ts:42-54` |
| BR-41 % ใช้สนาม = ชม. ÷ 16 | `OPEN_HOURS_PER_DAY` `rules/reports.ts:8` · `utilizationPercent` 81 | `server/backoffice.ts:93` (แดชบอร์ดรายวันเท่านั้น) | – |
| BR-42 ประวัติ / audit | `AUDIT_ACTIONS` `rules/records.ts:5-19` · `historyActorLabel` 35 (CUSTOMER/BOT/SYSTEM แปล · พนักงาน = username ตรง ๆ) | `server/backoffice.ts:169` · `server/db.ts:80-100` | trigger `mig/002_history_audit.sql:31-65` · CHECK `audit_logs_action_check` `:21-23` |
| BR-43 migration คู่ up/down | `planMigrations` `rules/records.ts:63-87` | `scripts/migrate.mjs:17` | – |
| BR-44 สิทธิ์หลังบ้าน | `canAccess` `rules/reports.ts:31` | `server/backoffice.ts:36` · `server/stock.ts:96,128` | `requireStaffPage` ในทุก `page.tsx` หลังบ้าน (ส่วน B) |
| BR-45 ลบเบอร์/ชื่อหลัง 90 วัน | `maskPhone` `rules/chat.ts:159` · `redactText` 189 · `redactionDue` 210 | `server/backoffice.ts:263-305,340,359` | trigger `chat_messages_guard` `mig/004_chat.sql:26-37` |
| NFR-22 CSV (BOM · CRLF · กันสูตร) | `csvCell` `rules/reports.ts:95` · `toCsv` 105 | `server/backoffice.ts:243` | หัวคอลัมน์ไทยเขียนตาย `server/backoffice.ts:231-234` |
| CSRF | `checkOrigin` `rules/records.ts:111` (ไม่มี Origin = ผ่าน) | `server/core.ts:85` | – |

## F. ฐานข้อมูล

### F1. ตาราง (25) และ constraint ที่ DB บังคับเอง

นับด้วยคำสั่ง (ไม่ใช่นับด้วยตา): `SELECT contype, count(*) FROM pg_constraint WHERE connamespace='public'::regnamespace GROUP BY 1` → **CHECK 44 · FK 31 · PK 25 · UNIQUE 4 · EXCLUDE 1**

| ตาราง | สร้างที่ | constraint (นอก PK/FK) | กฎเดียวกันในโค้ด |
|---|---|---|---|
| `schema_migrations` · `app_settings` | `mig/001_v1_baseline.sql:6,12` | – (`app_settings` เก็บ `clock`) | `server/core.ts:32-38` · `server/testing.ts:51-52` |
| `fields` | `mig/001_v1_baseline.sql:14` | `fields_rates_check` ≥ 0 · `fields_size_check` (5,7) `mig/005:26-27` | ราคา BR-07 อ่านจากคอลัมน์นี้ (`server/data.ts:59`) |
| `customers` | `mig/001_v1_baseline.sql:18` | `customers_phone_key` · `customers_credit_balance_check` ≥ 0 · `customers_hours_check` `mig/005:29-30` | BR-26 · BR-15 · BR-23 |
| `recurring_series` | `mig/001_v1_baseline.sql:23` | `recurring_series_weeks_check` 4–12 · `_discount_check` `mig/005:52-53` | `rules/extras.ts:9-15` |
| `bookings` | `mig/001_v1_baseline.sql:28-39` | `bookings_code_key` · `bookings_split_token_key` · `bookings_status_check` 7 สถานะ · `_payment_plan_check` · `_hours_check` · `_money_check` · `_reschedule_count_check` `mig/005:32-38` · **`bookings_no_overlap` EXCLUDE** `mig/005:77-81` | `BLOCKING_STATUSES` `rules/schedule.ts:13` (4 สถานะเดียวกัน) |
| `payments` | `mig/001_v1_baseline.sql:42` | `payments_amount_check` > 0 · `payments_method_check` (PROMPTPAY, CREDIT, CASH_AT_FIELD) `mig/005:40-41` | `server/bookings.ts:218` · `server/features.ts:447` |
| `credit_entries` | `mig/001_v1_baseline.sql:46` | `_amount_check` ≠ 0 · `_reason_check` 5 ค่า `mig/005:43-44` | – |
| `holidays` | `mig/001_v1_baseline.sql:50` | PK date | `server/features.ts:558-580` |
| `staff_users` | `mig/001_v1_baseline.sql:51` | `staff_users_username_key` · `_role_check` `mig/005:59` | `server/core.ts:141` · **ไม่มีคอลัมน์สถานะ session** |
| `field_closures` | `mig/001_v1_baseline.sql:54` | `_field_check` (A,B) · `_range_check` `mig/005:46-47` | `rules/booking.ts:6` `FIELDS_RAIN_CLOSABLE` |
| `rental_items` · `booking_rentals` | `mig/001_v1_baseline.sql:58-62` | `rental_items_numbers_check` · `booking_rentals_qty_check` `mig/005:49-50` · FK `rental_items_stock_item_fk` `mig/003_stock.sql:101-106` | v1 table เก็บไว้เพื่อถอย 003 |
| `split_shares` · `challenges` | `mig/001_v1_baseline.sql:63,67` | `split_shares_amount_check` · `challenges_status/level/amount_check` `mig/005:55-58` | `rules/extras.ts:123-154` |
| `booking_status_history` | `mig/002_history_audit.sql:8-16` | `_actor_check` (ไม่ว่าง) · trigger ห้ามแก้/ลบ | อ่าน `server/backoffice.ts:157-160` · `server/bookings.ts:353-354` |
| `audit_logs` | `mig/002_history_audit.sql:18-28` | `audit_logs_action_check` 13 ค่า (`:21-23`) · trigger ห้ามแก้/ลบ | `AUDIT_ACTIONS` `rules/records.ts:5-19` (ซ้ำกัน 2 ที่) |
| `stock_items` · `stock_locations` · `stock_levels` | `mig/003_stock.sql:9,17,22` | `stock_items_id_check` (8 ชิ้นตายตัว) · `_category_check` · `_unit_price_check` · `_reorder_point_check` · `stock_locations_id_check` · `stock_levels_qty_check` ≥ 0 | `rules/stock.ts:4-7` |
| `counter_sales` · `counter_sale_items` | `mig/003_stock.sql:29,38` | `_method_check` (CASH, PROMPTPAY) · `_total_amount_check` · `_qty_check` · `_unit_price_check` | `SALE_METHODS` `rules/stock.ts:7` |
| `stock_movements` | `mig/003_stock.sql:47-67` | `_type_check` · `_qty_check` > 0 · `_direction` · `_sale_from_counter` · `_sale_link` · `_reason` (DAMAGE/ADJUST) · trigger ห้ามแก้/ลบ | `server/stock.ts:59-70` |
| `chat_sessions` · `chat_messages` | `mig/004_chat.sql:7,16` · คอลัมน์ `ip_hash` `redacted_at` `mig/006_chat_hardening.sql:7-11` | `chat_sessions_lang_check` · `chat_messages_role_check` · trigger guard | `server/chat.ts:188,198,213` |

### F2. trigger (6 ตัว · `SELECT … FROM pg_trigger WHERE NOT tgisinternal`)

| trigger | ตาราง | ทำอะไร | ที่มา |
|---|---|---|---|
| `bookings_history_insert` | bookings AFTER INSERT | เขียนแถวประวัติ NULL → สถานะแรก · ไม่มี `app.actor` → ERROR | `mig/002_history_audit.sql:31-50` |
| `bookings_history_update` | bookings AFTER UPDATE OF status, date, start_hour | เขียนแถวประวัติเมื่อสถานะ/วัน/ชั่วโมงเปลี่ยน | `mig/002_history_audit.sql:51-54` |
| `booking_status_history_readonly` | booking_status_history BEFORE UPDATE/DELETE | `forbid_change()` | `mig/002_history_audit.sql:57-63` |
| `audit_logs_readonly` | audit_logs BEFORE UPDATE/DELETE | `forbid_change()` | `mig/002_history_audit.sql:64-65` |
| `stock_movements_readonly` | stock_movements BEFORE UPDATE/DELETE | `forbid_change()` (ประกาศซ้ำ) | `mig/003_stock.sql:70-75` |
| `chat_messages_readonly` | chat_messages BEFORE UPDATE/DELETE | `chat_messages_guard()` ยอมเฉพาะ `app.redact='on'` แก้ข้อความ | `mig/004_chat.sql:26-37` |

> row trigger ไม่ทำงานกับ `TRUNCATE` (seed ใช้ `db/init/02-seed.sql:8-13`) · role ของเว็บเป็น superuser → ปิด trigger ได้ (HANDOVER-CHECK H14)

### F3. migration (6 คู่)

| ไฟล์ | ทำอะไร | down ทำอะไร | หมายเหตุ |
|---|---|---|---|
| `mig/001_v1_baseline.sql:1-75` | 13 ตาราง v1 + `app_settings` + `schema_migrations` + `booking_code_seq` (`:72`) | `001_v1_baseline.down.sql:3-5` ลบแค่แถวใน `schema_migrations` | คอมเมนต์ `:2` บอกลำดับ 005→002 (ลืม 006) |
| `mig/002_history_audit.sql:1-75` | 2 ตาราง + 4 trigger + เติมประวัติแถวแรก (SYSTEM) `:67-72` | `002_history_audit.down.sql:3-17` ลบ trigger + 2 ตาราง | ข้อมูลประวัติหาย |
| `mig/003_stock.sql:1-109` | 6 ตารางคลัง + ข้อมูลอ้างอิง + ย้าย `rental_items.stock` → COUNTER `:92-94` | `003_stock.down.sql:3-12` | |
| `mig/004_chat.sql:1-40` | 2 ตารางแชท + guard | `004_chat.down.sql:2-7` | |
| `mig/005_constraints.sql:1-98` | `btree_gist` + CHECK 24 ตัว + EXCLUDE · ตรวจข้อมูลเดิมก่อน เจอผิด → หยุดทั้งไฟล์ `:88-95` | `005_constraints.down.sql:2-30` DROP CONSTRAINT | `add_check` ข้ามถ้าชื่อมีแล้ว `:13-23` |
| `mig/006_chat_hardening.sql:1-14` | `redacted_at` · `ip_hash` + index | `006_chat_hardening.down.sql:2-8` | |
| ตัวรัน | `scripts/migrate.mjs:31-41` up ทุกไฟล์ / down ทีละเลข (ไม่บังคับลำดับ) · นับ bookings ก่อน/หลัง `:29,42-45` | | `scripts/_db.mjs:43-47` `docker exec psql` |

## G. แชทบอท "น้องบอล": เส้นทาง mock / ai

| ขั้น | ไฟล์:บรรทัด |
|---|---|
| ลูกค้าพิมพ์ → `POST /api/chat` | `components/ChatWidget.tsx:176` → `app/api/chat/route.ts:6` |
| ตรวจความยาว · จำกัดต่อ IP (ค่าแรกของ `X-Forwarded-For`) · ต่อห้อง · สร้างห้อง (cookie `ln_chat` 90 วัน) | `server/chat.ts:161-192` · `clientIp` `:140-142` · cookie `:154-157` |
| ประวัติ 20 ข้อความล่าสุดของห้องส่งให้สมอง | `server/chat.ts:193-196` · `CHAT_HISTORY_TO_MODEL` `rules/chat.ts:19` |
| system prompt จาก DB (สนาม ราคา วันหยุด ปิดฝน 14 วัน ของเช่า) + บรรทัด `FACTS:` JSON | `server/chat.ts:119-137` · `chat/prompt.ts:25-71` |
| วนเรียกสมอง ≤ 2 รอบเครื่องมือ · tag `[CHECK]` `[QUOTE]` `[BOOK]` | `chat/engine.ts:58-103` · `MAX_TOOL_ROUNDS` `:37` |
| **เลือกสมอง** `MODE !== "ai"` → `mockBrain` · `MODE=ai` → `POST {LLM_BASE_URL}/chat/completions` Bearer `LLM_API_KEY` timeout 60 วิ | `server/chat.ts:42-57` |
| สมอง mock: ข้อความล่าสุดเท่านั้นสำหรับถาม "ว่าง/ราคา" (`extractField/Date/Hour` บนข้อความเดียว) · การจองเท่านั้นที่รวมหลายข้อความ (`collect`) | `chat/mock.ts:244-258` · `collect` `:151-164` · `:236` |
| ไม่เข้าใจ → "ไม่มีข้อมูล" + ช่องทางติดต่อ | `chat/mock.ts:277-278` |
| เครื่องมือ = ฟังก์ชันเดียวกับเว็บ (`evaluateBooking` · `fieldPriceFor` · `computePrice`) | `server/chat.ts:65-117` |
| กันตัวเลขแต่ง: จำนวนเงินต้องอยู่ในชุดที่อนุญาต (ราคาสนามจาก FACTS + ผลเครื่องมือ) ไม่งั้นแทนด้วยแม่แบบ | `chat/engine.ts:66-69,98-100` · `chat/templates.ts:28` |
| การ์ดยืนยัน → `POST /api/chat/book` (draftToken HMAC 15 นาที · `createBooking(…, "BOT")`) | `server/chat.ts:102-115,237-262` · `server/crypto.ts:43-52` |
| mock-llm (ai path ทดสอบ): สมองเดียวกันจาก `web/lib/chat/mock.ts` · ต้อง Bearer = `MOCK_LLM_TOKEN` | `web/mock-llm/server.mjs:1-30` |

## H. test seam (จุดที่ทดสอบได้โดยไม่แก้กฎ)

| seam | ปิดได้ไหม | ไฟล์:บรรทัด |
|---|---|---|
| `POST /api/test/reset` รัน `02-seed.sql` ทั้งไฟล์ (TRUNCATE ทุกตาราง) + ล็อกเวลา 9 ต.ค. 2026 10:00 | `ALLOW_TEST_RESET≠1` → 404 | `server/testing.ts:22-63` · `DEFAULT_TEST_NOW` `rules/records.ts:40` · seed `db/init/02-seed.sql:8-13` |
| `POST /api/test/clock` เลื่อน "ตอนนี้" (เก็บใน `app_settings.clock`) | เหมือนกัน | `server/testing.ts:51-52` · `getNow` `server/core.ts:32-38` |
| `BUG_MODE=1` ทางแยกบั๊กที่ฝังไว้ | env (ค่าเริ่ม 0) | `server/core.ts:27-29` · ตัวอย่างจุดแยก `rules/schedule.ts:44` · `rules/reports.ts:57` · `rules/stock.ts:35` |
| `MODE=mock` สมองตายตัว ไม่ออก network | env | `server/chat.ts:43` |
| `SEED_SQL_PATH` | env | `server/testing.ts:12-14` |
| ไม่มี Origin = ผ่าน CSRF (สคริปต์ทดสอบยิงตรงได้) | ไม่มีสวิตช์ | `rules/records.ts:111-119` |
| `X-Forwarded-For` ตั้งเองได้ (selfcheck ใช้แยก IP) | ไม่มีสวิตช์ | `server/chat.ts:140-142` · `web/selfcheck/check-testdata.mjs:29-33` |
| `data-testid` ทุก element + `<html data-ready data-bug-mode>` | – | `web/SPEC.md` §3, §10 (NFR-09) |
| ชุดตรวจ: unit `npm test` · `selfcheck/rules-check.mjs` · `selfcheck/check-testdata.mjs` (E148 รัน migrate + ถอย 005 จริง) | – | `web/package.json` `scripts.test` · `web/selfcheck/*.mjs` |

## I. กับดักถ้าจะแก้ (ทีมใหม่ต้องรู้)

| กับดัก | ไฟล์:บรรทัด |
|---|---|
| ราคาสนามอยู่ 4 ที่: ตาราง `fields` · ค่าคงที่หน้าแรก `SEED_FIELDS` · seed SQL · ข้อความ prompt/mock · price guard ของแชทเชื่อ FACTS | `server/schema.ts:5-9` · `db/init/02-seed.sql:16-19` · `chat/prompt.ts:55` · `chat/mock.ts:132-141` · `chat/engine.ts:68` |
| ราคาไม่มีวันมีผล: `fields` มีแค่ `day_rate` `evening_rate` (ไม่มีช่วงวันที่) · การจองเก็บ `field_price` / `total_price` ไว้แล้วจึงไม่ถูกคิดใหม่ ยกเว้นตอนเลื่อน | `mig/001_v1_baseline.sql:14-17` · `server/bookings.ts:499-514` |
| session ไม่มีสถานะฝั่ง server: cookie = `sign({cid})` / `sign({sid})` ไม่มี id / วันหมดอายุในตัว · logout แค่สั่งเบราว์เซอร์ลบ cookie | `server/crypto.ts:21-41` · `server/auth.ts:36,51` · `app/api/customers/logout/route.ts:5-9` · `app/api/staff/logout/route.ts:5-9` |
| ผู้ทำในประวัติเก็บเป็น username (`tx(…, { actor: staff.username })`) ไม่ใช่ id/ชื่อ | `server/features.ts:457,477,665` · `rules/records.ts:35-37` |
| ข้อความ "เกิดข้อผิดพลาดในระบบ" เกิดได้จากฝั่งเบราว์เซอร์เอง (คำตอบไม่ใช่ JSON เช่น 308/405) | `web/lib/client.ts:24` · `MyClient.tsx:77` |
| `rentableTotal` (BR-38) ไม่มีผู้เรียก · ใช้ SQL แทน | `rules/stock.ts:76` · `server/data.ts:74-79` |
| `AUDIT_ACTIONS` เขียน 2 ที่ (TS + CHECK) · เพิ่ม action ต้องแก้ทั้งคู่ + migration ใหม่ | `rules/records.ts:5-19` · `mig/002_history_audit.sql:21-23` |
| `db/init/*` รันครั้งเดียวตอนสร้าง volume → เปลี่ยน schema ต้องเป็น migration ใหม่ + เติมใน `01-schema.sql` | `db/init/01-schema.sql:4-10` · `docs/RUNBOOK.md` §7 |
| `/api/version` ใช้ `max(version)` จึงไม่เห็น migration ที่ถูกถอยตรงกลาง | `app/api/version/route.ts:12` |
| CSV หัวคอลัมน์ไทยเขียนตาย · ร้านมีสูตร Excel ผูกลำดับคอลัมน์ (CR-03) | `server/backoffice.ts:225-242` |
| e2e ผูก seed + วันล็อก 9 ต.ค. 10:00 · reset ทุกครั้งก่อนรัน | `rules/records.ts:40` · `e2e/global-setup.ts` |

## J. นับแถวของแผนที่นี้

| ส่วน | แถว |
|---|---:|
| A สถาปัตยกรรม | 11 |
| B หน้าเว็บ | 26 (ครอบ 32 page.tsx + widget) |
| C API | 60 (+ 20 ตัว 404 รวม 1 แถว) |
| D โมดูล server | 18 |
| E กฎ | 32 |
| F1 ตาราง | 18 (ครอบ 25 ตาราง) |
| F2 trigger | 6 |
| F3 migration | 7 |
| G แชทบอท | 12 |
| H seam | 9 |
| I กับดัก | 11 |
| L CR → file:line | 9 |
| **รวม** | **219** |

## K. ยังไม่รู้ (ต้องหาหลักฐานเพิ่ม · ไม่เดา)

1. role `football` ของเว็บเป็น superuser — ตั้งใจไหม หรือแค่ค่าเริ่มของ image (ไม่มีเอกสารบอก) → ถามผู้ดูแลเครื่อง / SPEC-GAPS G-36
2. การจองแข่งกัน 2 คำขอได้ 201 + 409 — ไม่รู้ว่าชั้นไหนหยุด (advisory lock `server/bookings.ts:236` + `checkNoOverlap` หรือ EXCLUDE) เพราะทั้งสองตอบ `SLOT_TAKEN` เหมือนกัน · พิสูจน์ได้ด้วยการปิดทีละชั้นในสำเนาฐาน (mutant แผน L4)
3. e2e ชุดเดิมมีเคสที่ "เช็กอินล่วงหน้า" หรือ "ราคา 1,200 หลัง 1 พ.ย." เป็นค่าคาดหวังไหม — ต้อง grep `e2e/tests` ตอนทำ impact (L5)
4. `MODE=ai` กับโมเดลจริงจะจำบทสนทนาได้แค่ไหน (CR-04) — ตอนนี้เห็นแค่ทาง mock

## L. CR → ไฟล์/ฟังก์ชันที่จะต้องแตะ (ยังไม่ลงมือ · ให้ทำ impact เต็มในแผน L5)

| CR | เรื่อง | จุดที่ต้องแตะ (ไฟล์:บรรทัด) | DB | เทสต์ที่เกี่ยว (เดิม) |
|---|---|---|---|---|
| **CR-01** ออกจากระบบแล้วยังใช้ต่อได้ | ต้องมี session ฝั่ง server หรือรายการ token ที่ถูกยกเลิก | สร้าง/ตรวจ cookie: `server/crypto.ts:21-41` (`sign`/`unsign`) · `server/core.ts:133-148` (`customerIdFrom` `staffFrom`) · `server/core.ts:157` (`cookieOpts` 30 วัน) · ออก cookie: `server/auth.ts:27,36,51` · logout: `app/api/customers/logout/route.ts:5-9` · `app/api/staff/logout/route.ts:5-9` · ผู้อ่าน session อื่น: `server/page.ts:14-31` · `server/bookings.ts:164-166,291-294` · `server/chat.ts:187` · cookie `ln_access` `server/access.ts:7-12` (ตัดสินใจว่ารวมไหม) | ตารางใหม่ (เช่น `sessions`/`revoked_tokens`) → migration 007 + down + `01-schema.sql` | e2e TC-ROLE-03 (แดงอยู่) · unit R9 (`lib/server/security.test.ts`) |
| **CR-02 (1)** เช็กอินเฉพาะวันเตะ | เพิ่มเงื่อนไขวัน | `server/features.ts:441-459` (`staffCheckin`) · ปุ่ม/เหตุผล `server/features.ts:422` (`checkinBlockedBy`) · กฎใหม่ใน `rules/booking.ts` (ข้าง `checkNoShow` `:73`) · ข้อความใหม่ `web/lib/i18n.ts:14+` · UI `app/staff/StaffClient.tsx:85-88,160` | – | TC-STAFF-06 (แดง) · rules-check / check-testdata ที่เช็กอินล่วงหน้า (ต้องตรวจว่ามีไหม) |
| **CR-02 (2)** ประวัติแสดงชื่อพนักงาน | แปล username → `staff_users.name` | `rules/records.ts:35-37` (`historyActorLabel`) · `server/backoffice.ts:157-169` (JOIN `staff_users`) · UI `app/owner/bookings/[code]/BookingHistoryClient.tsx:73-74` · (ต้นทาง actor = username `server/features.ts:457,477,665`) | อ่านอย่างเดียว (ไม่แก้แถวประวัติเก่า) | TC-DATA-01 (แดง) |
| **CR-02 (3)** ขั้น "จบ" ใน timeline | แสดงขั้นสุดท้ายเมื่อเวลาเล่นจบ (A-43: ไม่ใช่สถานะใหม่) | `server/bookings.ts:353-354,400` (`history` ใน `bookingDetail`) · UI `app/booking/[code]/BookingClient.tsx:159-180` · ป้าย `web/lib/i18n.ts:186-200` | ไม่แตะ (ไม่มีสถานะใหม่) | TC-TRACK-01 (แดง) |
| **CR-02 (4)** ช่วงรายงาน 30 พ.ย.–28 ก.พ. | ความหมาย "3 เดือน" เมื่อเริ่มปลายเดือน | `rules/reports.ts:11-26` (`addMonths` · `checkReportRange`) · ผู้เรียก `server/backoffice.ts:176` (+ CSV `:230`) · ข้อความ `REPORT_RANGE_TOO_LONG` `web/lib/i18n.ts:97` | – | TC-REPORT-01 (แดง) · TEST-DATA E140–E142 · unit `rules/v2.test.ts:154-155` |
| **CR-02 (5)** ค้นการจองโดยไม่กรอก | ตรวจช่องว่างก่อนเรียก API | `app/my/MyClient.tsx:75-78` · (`web/lib/client.ts:24` แปลงเป็น INTERNAL) · ข้อความใหม่ `web/lib/i18n.ts` | – | TC-BOOK-11 (แดง) |
| **CR-03** รายงานแยกช่องทางเงิน + ชั่วโมงสนาม | แยก `bookingMoney` ตาม `payments.method` · ชั่วโมง/% ต่อสนามตามช่วง | `server/backoffice.ts:42-54` (`moneyRows` ต้องส่ง method ออกมา) · `rules/reports.ts:43-78` (`summarizeMoney` · `DayMoney`) · `server/backoffice.ts:174-223` (`report`) · CSV `server/backoffice.ts:225-252` (ต่อคอลัมน์ท้าย อย่าสลับลำดับ) · `rules/reports.ts:81` (`utilizationPercent` ปัจจุบันต่อวัน) · UI `app/owner/reports/ReportsClient.tsx:12-25,105-119` · แดชบอร์ดใช้ `summarizeMoney` ร่วม `server/backoffice.ts:72` | อ่านอย่างเดียว | TC-REPORT-04 (แดง) · TEST-DATA ตัวเลข 5.4 · unit BR-40/41 `rules/v2.test.ts` |
| **CR-04** น้องบอลจำเรื่องที่คุย | ใช้ วัน/เวลา/สนาม จากข้อความก่อนในห้อง + ตอบช่วงราคาถูกสุด | `chat/mock.ts:244-258` (ใช้แค่ `text` ปัจจุบัน) · `collect` `:151-164` (มีอยู่แล้วสำหรับการจอง) · `RE_PRICE` `:118` (ไม่จับ "ถูกสุด") · fallback `:277-278` · prompt `chat/prompt.ts:53-71` (ทาง ai) · ประวัติส่งแล้ว `server/chat.ts:193-205` · EN `chat/templates.ts:7` | – | TC-CHAT-14/15/16 (แดง) · check-testdata E109–E120 · unit `lib/chat/chat.test.ts` · `mock-llm/server.test.mjs` |
| **CR-05** ราคาเย็นสนาม 5 คน ฿1,300 ตั้งแต่ 1 พ.ย. 2569 | ราคามีวันมีผล · การจองเดิมไม่เปลี่ยนยอด | `rules/pricing.ts:28-39` (`hourlyRate` `fieldPriceFor` รับ `Rates` ไม่มีวันที่) · ผู้เรียก `server/bookings.ts:142,148,160,508-509` · `server/features.ts:82,160` · `server/chat.ts:95` · `server/data.ts:59` (`loadFields`) · หน้าแรก `server/schema.ts:5-9` + `app/page.tsx:67,85` · `/fields` `app/fields/page.tsx:44-51` · `/api/availability` `server/features.ts:93` · แชท `chat/prompt.ts:40,55` · `chat/mock.ts:132-141` · price guard `chat/engine.ts:68` · seed `db/init/02-seed.sql:16-19` (ต้องคงค่าเดิมให้ e2e) · เลื่อนวันคิดราคาใหม่ `server/bookings.ts:499-514` (ต้องถามร้าน) · จองประจำข้าม 1 พ.ย. `server/features.ts:149-162` | migration 007: ตารางราคาตามช่วงวัน (เช่น `field_rates(field_id, effective_from, day_rate, evening_rate)`) + down · ห้ามแตะ `bookings.field_price/total_price` เดิม (ทดสอบบน `PROD-LIKE-DATA` 16 การจองหลัง 1 พ.ย.) | TC ราคา BR-07/08 ทั้งหมด · unit `rules/rules.test.ts` · check-testdata (ราคา 1,200) · e2e ที่เลื่อนนาฬิกาเลย 1 พ.ย. (ถ้ามี) |
