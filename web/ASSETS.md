# ASSETS — รูปและฟอนต์ของเว็บ "ลูกหนัง อารีน่า"

ทุกรูปวาดเป็น **SVG ในโค้ดของโปรเจกต์เอง** (เครื่องไม่มี Codex · ไม่ใช้รูปจากอินเทอร์เน็ต · ไม่มีไฟล์ภาพบิตแมปในเว็บ) · สีตามธีมสนามกลางคืน
เขียวเข้ม `#0B3D2E` · เขียวหญ้า `#1F9D55` · ขาวชอล์ก `#F7F7F2` · เหลืองไฟสนาม `#FFD54A` · ทุกรูปที่มีความหมายมี `role="img"` + `aria-label` + `<title>` (NFR-13) · รูปตกแต่งมี `aria-hidden="true"`

| ไฟล์ / ส่วนประกอบ | ใช้ที่หน้า | สร้างด้วย | ข้อความแทนรูป (TH / EN) |
|---|---|---|---|
| `app/icon.svg` | favicon ทุกหน้า | SVG เขียนมือ (v1) | – (ไอคอนแท็บ) |
| `components/Art.tsx` → `Logo` | หัวเว็บทุกหน้า | SVG ใน React (v1) | "โลโก้ลูกหนัง อารีน่า" / "Luknang Arena logo" |
| `components/Art.tsx` → `FieldArt` (A, B, C) | `/`, `/fields`, `/book/new`, `/booking/[code]` | SVG ใน React สร้างจากขนาดสนามและหลังคา (v1) | "ภาพวาดสนาม {id} {5/7} คน {กลางแจ้ง/มีหลังคา}" / "Drawing of field {id}, …" (ส่งจากแต่ละหน้า) |
| `components/Art.tsx` → `PitchLines` | `/` (พื้นหลังส่วนหัว) | SVG ใน React (v1) | ตกแต่ง `aria-hidden` |
| `components/Art.tsx` → `SampleQr` | `/pay/[code]`, `/challenges` (จ่ายรับคำท้า) | SVG ใน React สุ่มลายจากรหัส (v1) | "QR พร้อมเพย์ตัวอย่าง (จำลอง …)" / "Sample PromptPay QR …" |
| 🆕 `components/Art.tsx` → `BotAvatar` | ปุ่มแชทลอยและหัวหน้าต่างแชท (ทุกหน้าฝั่งลูกค้า) | SVG ใน React: ลูกฟุตบอลยิ้มใส่หูฟัง (v2) | หัวแชท: "รูปน้องบอล" / "Nong Ball" · ในปุ่ม: ตกแต่ง `aria-hidden` (ปุ่มมีข้อความ "แชทกับน้องบอล" / "Chat with Nong Ball") |
| 🆕 `components/Art.tsx` → `EmptyNet` | `/owner/bookings` (ไม่พบผล), `/owner/chats` (ยังไม่มีแชท) | SVG ใน React: ตาข่ายประตูกับลูกบอล (v2) | "ไม่พบการจอง" / "No bookings" · "ยังไม่มีแชท" / "No chats yet" |
| 🆕 กราฟแท่ง 7 วัน (`WeekChart` ใน `app/owner/dashboard/DashboardClient.tsx`) | `/owner/dashboard` | SVG ใน React สร้างจากข้อมูล (ไม่ใช้ไลบรารีกราฟ · FR-42) | "กราฟยอดเงิน 7 วันล่าสุด" / "Money of the last 7 days" · แต่ละแท่งมี `<title>` วันที่ + ยอด และ `data-value` |
| 🆕 แถบเปอร์เซ็นต์ / ชั่วโมงยอดนิยม (`.meter`) | `/owner/dashboard` | CSS | ตกแต่ง `aria-hidden` (ตัวเลขแสดงเป็นข้อความข้าง ๆ) |
| ฟอนต์ Prompt (400/600/700) · IBM Plex Sans Thai (400/600) | ทุกหน้า | แพ็กเกจ npm `@fontsource/prompt`, `@fontsource/ibm-plex-sans-thai` ติดตั้งในโปรเจกต์ (ไม่โหลดจากเน็ตตอนใช้งาน) | – |

ภาพหน้าจอสำหรับตรวจ (ไม่ใช่ส่วนของเว็บ): `selfcheck/screens/*.png` (v1) และ `selfcheck/screens/v2-*.png` (v2 · ทุกหน้าใหม่ 1280 / 375 px · สร้างด้วย `node selfcheck/screens-v2.mjs`)
