// TH/EN dictionary (ADR-06). Shared by server and client code.
export type Lang = "th" | "en";

export function normLang(v: string | undefined | null): Lang {
  return v === "en" ? "en" : "th";
}

/** inline UI text helper */
export function tx(lang: Lang, th: string, en: string): string {
  return lang === "en" ? en : th;
}

/** Every error / confirmation message, word for word (documented in SPEC.md). */
export const MESSAGES: Record<string, { th: string; en: string; status?: number }> = {
  // ---- validation / business rule errors ----
  INVALID_INPUT: { th: "ข้อมูลไม่ถูกต้อง", en: "Invalid input", status: 400 },
  INVALID_FIELD: { th: "ไม่พบสนามที่เลือก", en: "Field not found", status: 400 },
  INVALID_DATE: { th: "วันที่ไม่ถูกต้อง", en: "Invalid date", status: 400 },
  INVALID_START_HOUR: { th: "เวลาเริ่มต้องตรงชั่วโมง ระหว่าง 08:00 ถึง 23:00", en: "Start time must be on the hour between 08:00 and 23:00", status: 400 },
  INVALID_HOURS: { th: "จำนวนชั่วโมงต้องเป็นจำนวนเต็มอย่างน้อย 1 ชั่วโมง", en: "Duration must be a whole number of at least 1 hour", status: 400 },
  ENDS_AFTER_MIDNIGHT: { th: "การจองต้องจบไม่เกิน 24:00", en: "Bookings must end by 24:00", status: 400 },
  PAST_DATE: { th: "ไม่สามารถจองวันที่ผ่านมาแล้ว", en: "You cannot book a date in the past", status: 400 },
  TOO_FAR_AHEAD: { th: "จองล่วงหน้าได้ไม่เกิน 14 วัน", en: "You can book at most 14 days ahead", status: 400 },
  TOO_SOON: { th: "ต้องจองก่อนเวลาเริ่มอย่างน้อย 1 ชั่วโมง", en: "Bookings must start at least 1 hour from now", status: 400 },
  SLOT_TAKEN: { th: "ช่วงเวลานี้ถูกจองแล้ว", en: "This time slot is already booked", status: 409 },
  FIELD_CLOSED: { th: "สนามปิดในช่วงเวลานี้", en: "The field is closed during this time", status: 409 },
  CUSTOMER_BANNED: { th: "เบอร์นี้ถูกระงับการจองออนไลน์ จองได้อีกครั้ง {date}", en: "Online booking is suspended for this phone number. You can book again on {date}", status: 403 },
  NAME_REQUIRED: { th: "กรุณากรอกชื่อ", en: "Please enter your name", status: 400 },
  INVALID_PHONE: { th: "เบอร์โทรต้องเป็นตัวเลข 10 หลักขึ้นต้นด้วย 0", en: "Phone number must be 10 digits starting with 0", status: 400 },
  CONSENT_REQUIRED: { th: "กรุณายินยอมให้เก็บข้อมูลส่วนบุคคล (PDPA) ก่อนดำเนินการ", en: "Please give PDPA consent before continuing", status: 400 },
  INVALID_QTY: { th: "จำนวนของเช่าไม่ถูกต้อง", en: "Invalid rental quantity", status: 400 },
  RENTAL_OUT_OF_STOCK: { th: "ของเช่าไม่พอ ({item} เหลือ {remaining})", en: "Not enough rental items ({item}: {remaining} left)", status: 409 },
  INVALID_CREDIT: { th: "จำนวนเครดิตไม่ถูกต้อง", en: "Invalid credit amount", status: 400 },
  CREDIT_EXCEEDS_TOTAL: { th: "ใช้เครดิตเกินยอดรวมไม่ได้", en: "Credit cannot exceed the total price", status: 400 },
  CREDIT_INSUFFICIENT: { th: "เครดิตไม่พอ", en: "Not enough credit", status: 400 },
  MEMBER_REQUIRED: { th: "ต้องเข้าสู่ระบบสมาชิกก่อน", en: "Please log in as a member first", status: 401 },
  FREE_HOUR_NOT_ELIGIBLE: { th: "ใช้ชั่วโมงฟรีได้เฉพาะรอบที่เริ่มก่อน 17:00 วันจันทร์–ศุกร์", en: "Free hours can only be used for slots starting before 17:00, Monday–Friday", status: 400 },
  FREE_HOUR_NONE: { th: "ยังไม่มีสิทธิ์ชั่วโมงฟรี", en: "You have no free hours yet", status: 400 },
  BOOKING_NOT_FOUND: { th: "ไม่พบการจอง", en: "Booking not found", status: 404 },
  BOOKING_FORBIDDEN: { th: "เบอร์โทรไม่ตรงกับการจองนี้", en: "The phone number does not match this booking", status: 403 },
  INVALID_STATUS: { th: "สถานะการจองนี้ทำรายการนี้ไม่ได้", en: "This action is not allowed for the booking's current status", status: 409 },
  PAYMENT_EXPIRED: { th: "หมดเวลาชำระเงิน รอบเวลานี้ว่างแล้ว", en: "Payment time has expired. The slot is available again", status: 409 },
  CANCEL_TOO_LATE: { th: "ยกเลิกได้ก่อนเวลาเริ่มเท่านั้น", en: "Bookings can only be cancelled before the start time", status: 409 },
  RESCHEDULE_LIMIT: { th: "เลื่อนได้ 1 ครั้งต่อการจอง", en: "A booking can be rescheduled only once", status: 409 },
  RESCHEDULE_TOO_LATE: { th: "เลื่อนได้เมื่อเหลือเวลาอย่างน้อย 24 ชั่วโมงก่อนเวลาเริ่ม", en: "Rescheduling requires at least 24 hours before the start time", status: 409 },
  RESCHEDULE_SAME: { th: "กรุณาเลือกวันหรือเวลาใหม่ที่ต่างจากเดิม", en: "Please choose a different date or time", status: 400 },
  NO_SHOW_TOO_EARLY: { th: "บันทึกไม่มาได้เมื่อเลยเวลาเริ่มอย่างน้อย 15 นาที", en: "No-show can be recorded only 15 minutes after the start time", status: 409 },
  SERIES_WEEKS_RANGE: { th: "จองประจำได้ 4–12 สัปดาห์", en: "Recurring bookings must be 4–12 weeks", status: 400 },
  SERIES_CONFLICT: { th: "มีสัปดาห์ที่ชน: {dates} กรุณายืนยันจองเฉพาะสัปดาห์ที่ว่าง", en: "Some weeks are taken: {dates}. Please confirm booking only the free weeks", status: 409 },
  SERIES_NONE_AVAILABLE: { th: "ไม่มีสัปดาห์ที่ว่างให้จอง", en: "No free weeks to book", status: 409 },
  RAIN_COVERED_FIELD: { th: "สนาม {field} มีหลังคา ปิดเพราะฝนไม่ได้", en: "Field {field} is covered and cannot be closed for rain", status: 400 },
  INVALID_RANGE: { th: "ช่วงเวลาไม่ถูกต้อง", en: "Invalid time range", status: 400 },
  HOLIDAY_EXISTS: { th: "มีวันหยุดวันนี้อยู่แล้ว", en: "This holiday already exists", status: 409 },
  HOLIDAY_NOT_FOUND: { th: "ไม่พบวันหยุด", en: "Holiday not found", status: 404 },
  CHALLENGE_NOT_ALLOWED: { th: "ประกาศหาคู่แข่งได้เฉพาะการจองที่ยืนยันแล้วและยังไม่ถึงเวลาเริ่ม", en: "Only confirmed bookings that have not started can look for an opponent", status: 409 },
  CHALLENGE_EXISTS: { th: "การจองนี้ประกาศหาคู่แข่งแล้ว", en: "This booking already has a challenge", status: 409 },
  CHALLENGE_NOT_FOUND: { th: "ไม่พบประกาศหาคู่แข่ง", en: "Challenge not found", status: 404 },
  CHALLENGE_NOT_OPEN: { th: "ประกาศนี้ไม่เปิดรับแล้ว", en: "This challenge is no longer open", status: 409 },
  CHALLENGE_OWN: { th: "รับคำท้าของตัวเองไม่ได้", en: "You cannot accept your own challenge", status: 409 },
  CHALLENGE_PAYMENT_EXPIRED: { th: "หมดเวลาชำระเงิน ประกาศกลับมาเปิดรับแล้ว", en: "Payment time has expired. The challenge is open again", status: 409 },
  CHALLENGE_MATCHED: { th: "มีทีมรับคำท้าแล้ว ยกเลิกหรือเลื่อนการจองนี้ไม่ได้", en: "A team has accepted the challenge. This booking can't be cancelled or rescheduled", status: 409 },
  CHALLENGE_PENDING: {
    th: "มีทีมกำลังชำระเงินรับคำท้า เลื่อนการจองได้หลังชำระเสร็จหรือหมดเวลา 15 นาที",
    en: "A team is paying for the challenge. You can reschedule after they pay or after 15 minutes",
    status: 409,
  },
  CHALLENGE_WRONG_PHONE: { th: "เบอร์โทรไม่ตรงกับทีมที่รับคำท้า", en: "The phone number does not match the accepting team", status: 403 },
  TEAM_REQUIRED: { th: "กรุณากรอกชื่อทีม", en: "Please enter a team name", status: 400 },
  INVALID_LEVEL: { th: "กรุณาเลือกระดับทีม", en: "Please choose a team level", status: 400 },
  SPLIT_COUNT: { th: "จำนวนคนต้องอยู่ระหว่าง 2–30 คน", en: "The number of people must be 2–30", status: 400 },
  SPLIT_NOT_FOUND: { th: "ไม่พบลิงก์หารค่าสนาม", en: "Split link not found", status: 404 },
  RETURN_EXCEEDS: { th: "จำนวนคืนเกินจำนวนที่เช่า", en: "Returned quantity exceeds the rented quantity", status: 400 },
  LOGIN_FAILED: { th: "เบอร์โทรหรือรหัสผ่านไม่ถูกต้อง", en: "Incorrect phone number or password", status: 401 },
  STAFF_LOGIN_FAILED: { th: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง", en: "Incorrect username or password", status: 401 },
  ALREADY_REGISTERED: { th: "เบอร์นี้สมัครสมาชิกแล้ว กรุณาเข้าสู่ระบบ", en: "This phone number is already registered. Please log in", status: 409 },
  PASSWORD_TOO_SHORT: { th: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร", en: "Password must be at least 8 characters", status: 400 },
  UNAUTHORIZED: { th: "กรุณาเข้าสู่ระบบ", en: "Please log in", status: 401 },
  FORBIDDEN_ROLE: { th: "บทบาทของคุณไม่มีสิทธิ์เข้าถึงส่วนนี้", en: "Your role is not allowed to access this", status: 403 },
  NOT_FOUND: { th: "ไม่พบข้อมูล", en: "Not found", status: 404 },
  INTERNAL: { th: "เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่", en: "Something went wrong. Please try again", status: 500 },
  NETWORK: { th: "เชื่อมต่อไม่ได้ กรุณาลองใหม่", en: "Connection failed. Please try again", status: 0 },

  // ---- confirmations ----
  OK_PAID: { th: "ชำระเงินสำเร็จ การจองได้รับการยืนยันแล้ว", en: "Payment successful. Your booking is confirmed" },
  OK_CONFIRMED_FREE: { th: "ยืนยันการจองแล้ว (ยอดที่ต้องจ่าย ฿0)", en: "Booking confirmed (nothing to pay)" },
  OK_CANCEL_CREDIT: { th: "ยกเลิกแล้ว ได้รับเครดิตคืน {amount}", en: "Cancelled. {amount} credit returned" },
  OK_CANCEL_NO_CREDIT: { th: "ยกเลิกแล้ว ไม่ได้รับเครดิตคืน เพราะเหลือเวลาน้อยกว่า 24 ชั่วโมง", en: "Cancelled. No credit returned because less than 24 hours remained" },
  OK_CANCEL_PENDING: { th: "ยกเลิกแล้ว", en: "Cancelled" },
  OK_RESCHEDULED: { th: "เลื่อนการจองแล้ว", en: "Booking rescheduled" },
  OK_RESCHEDULED_PAY: { th: "เลื่อนการจองแล้ว จ่ายส่วนต่าง {amount} เรียบร้อย", en: "Booking rescheduled. Difference of {amount} paid" },
  OK_RESCHEDULED_CREDIT: { th: "เลื่อนการจองแล้ว ได้รับส่วนต่างเป็นเครดิต {amount}", en: "Booking rescheduled. Difference of {amount} returned as credit" },
  OK_SPLIT_CREATED: { th: "สร้างลิงก์หารค่าสนามแล้ว", en: "Split link created" },
  OK_SPLIT_EXISTS: { th: "การจองนี้มีลิงก์หารค่าสนามแล้ว ใช้ลิงก์เดิม", en: "This booking already has a split link. The existing link is used" },
  OK_CHALLENGE_CREATED: { th: "ประกาศหาคู่แข่งแล้ว", en: "Challenge posted" },
  OK_CHALLENGE_ACCEPTED: { th: "รับคำท้าแล้ว กรุณาชำระเงินภายใน 15 นาที", en: "Challenge accepted. Please pay within 15 minutes" },
  OK_CHALLENGE_MATCHED: { th: "ชำระเงินสำเร็จ จับคู่แข่งเรียบร้อย", en: "Payment successful. Match confirmed" },
  OK_CHECKED_IN: { th: "เก็บเงินและเช็กอินแล้ว", en: "Payment collected and checked in" },
  OK_NO_SHOW: { th: "บันทึกไม่มาแล้ว", en: "No-show recorded" },
  OK_NO_SHOW_BANNED: { th: "บันทึกไม่มาแล้ว ลูกค้าถูกระงับการจองออนไลน์ถึง {date}", en: "No-show recorded. The customer is suspended from online booking until {date}" },
  OK_RETURNED: { th: "บันทึกคืนของเช่าแล้ว", en: "Rental returns saved" },
  OK_HOLIDAY_ADDED: { th: "เพิ่มวันหยุดแล้ว", en: "Holiday added" },
  OK_HOLIDAY_DELETED: { th: "ลบวันหยุดแล้ว", en: "Holiday deleted" },
  OK_CLOSED: { th: "ปิดสนามแล้ว คืนเครดิต {count} การจอง", en: "Field closed. Credit returned for {count} booking(s)" },
  OK_REGISTERED: { th: "สมัครสมาชิกสำเร็จ", en: "Registration successful" },
  OK_SERIES_CREATED: { th: "สร้างการจองประจำแล้ว กรุณาชำระเงินภายใน 15 นาที", en: "Recurring booking created. Please pay within 15 minutes" },
};

export function msg(lang: Lang, code: string, params?: Record<string, string | number>): string {
  const m = MESSAGES[code] ?? MESSAGES.INTERNAL;
  let s = lang === "en" ? m.en : m.th;
  if (params) for (const [k, v] of Object.entries(params)) s = s.split("{" + k + "}").join(String(v));
  return s;
}

/** ฿1,200 in Thai · THB 1,200 in English (฿ is a Thai-block character, NFR-03) */
export function money(lang: Lang, n: number): string {
  const s = Math.abs(n).toLocaleString("en-US");
  const sign = n < 0 ? "−" : "";
  return lang === "en" ? `${sign}THB ${s}` : `${sign}฿${s}`;
}

const TH_DAYS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
const EN_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TH_DAYS_SHORT = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
const EN_DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const EN_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function weekdayName(lang: Lang, w: number, short = false): string {
  if (short) return lang === "en" ? EN_DAYS_SHORT[w] : TH_DAYS_SHORT[w];
  return lang === "en" ? EN_DAYS[w] : TH_DAYS[w];
}

/** "ศ. 9 ต.ค. 2026" / "Fri 9 Oct 2026" */
export function fmtDate(lang: Lang, date: string, withWeekday = true): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const [y, m, d] = date.split("-").map(Number);
  const w = new Date(date + "T00:00:00Z").getUTCDay();
  const core = lang === "en" ? `${d} ${EN_MONTHS[m - 1]} ${y}` : `${d} ${TH_MONTHS[m - 1]} ${y}`;
  return withWeekday ? `${weekdayName(lang, w, true)} ${core}` : core;
}

/** date-time of an ISO instant in Bangkok time: "9 ต.ค. 2026 19:15" */
export function fmtDateTime(lang: Lang, iso: string | null | undefined): string {
  if (!iso) return "-";
  const t = new Date(new Date(iso).getTime() + 7 * 3600e3);
  const date = t.toISOString().slice(0, 10);
  const hm = t.toISOString().slice(11, 16);
  return `${fmtDate(lang, date, false)} ${hm}`;
}

export function timeRange(startHour: number, hours: number): string {
  const p = (h: number) => String(h).padStart(2, "0") + ":00";
  return `${p(startHour)}–${p(startHour + hours)}`;
}

export const STATUS_LABEL: Record<string, { th: string; en: string }> = {
  PENDING_PAYMENT: { th: "รอชำระเงิน", en: "Awaiting payment" },
  CONFIRMED: { th: "ยืนยันแล้ว", en: "Confirmed" },
  CHECKED_IN: { th: "เช็กอินแล้ว", en: "Checked in" },
  NO_SHOW: { th: "ไม่มา", en: "No-show" },
  CANCELLED: { th: "ยกเลิกแล้ว", en: "Cancelled" },
  EXPIRED: { th: "หมดเวลาชำระ", en: "Expired" },
  RAIN_CLOSED: { th: "ปิดเพราะฝน", en: "Closed (rain)" },
  OPEN: { th: "เปิดรับ", en: "Open" },
  AWAITING_PAYMENT: { th: "รอทีมรับจ่ายเงิน", en: "Awaiting payment" },
  MATCHED: { th: "จับคู่แล้ว", en: "Matched" },
  CLOSED: { th: "ปิดประกาศ", en: "Closed" },
};

export function statusLabel(lang: Lang, s: string): string {
  const l = STATUS_LABEL[s];
  return l ? (lang === "en" ? l.en : l.th) : s;
}

/** BR-28 / A-19: team level words — มือใหม่ / กลาง / เก่ง (EN: Beginner / Intermediate / Advanced) */
export const LEVEL_LABEL: Record<string, { th: string; en: string }> = {
  BEGINNER: { th: "มือใหม่", en: "Beginner" },
  INTERMEDIATE: { th: "กลาง", en: "Intermediate" },
  ADVANCED: { th: "เก่ง", en: "Advanced" },
};

export const CREDIT_REASON_LABEL: Record<string, { th: string; en: string }> = {
  CANCEL: { th: "คืนจากการยกเลิก", en: "Cancellation refund" },
  RAIN: { th: "คืนจากปิดเพราะฝน", en: "Rain closure refund" },
  CHALLENGE: { th: "ได้จากทีมรับคำท้า", en: "From challenge opponent" },
  RESCHEDULE: { th: "ส่วนต่างจากการเลื่อน", en: "Reschedule difference" },
  USED: { th: "ใช้จ่ายค่าจอง", en: "Used for booking" },
};

export function label(lang: Lang, table: Record<string, { th: string; en: string }>, key: string): string {
  const l = table[key];
  return l ? (lang === "en" ? l.en : l.th) : key;
}

export function fieldName(lang: Lang, id: string): string {
  return lang === "en" ? `Field ${id}` : `สนาม ${id}`;
}

export function rentalName(lang: Lang, id: string): string {
  if (id === "BIB") return lang === "en" ? "Bib" : "เอี๊ยม";
  if (id === "BALL") return lang === "en" ? "Ball" : "ลูกบอล";
  return id;
}

export const SHOP_NAME = { th: "ลูกหนัง อารีน่า", en: "Luknang Arena" };
