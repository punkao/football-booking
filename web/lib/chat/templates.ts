// Fixed sentences for tool results (used by the mock brain and as the BR-30 fallback when a model invents numbers).
import { fmtDate, money, msg, timeRange } from "../i18n.ts";
import type { DayResult, ToolResult } from "./engine.ts";

export type Lang = "th" | "en";

export function detectLang(text: string): Lang {
  return /[฀-๿]/.test(text) ? "th" : "en";
}

const fieldLabel = (lang: Lang, id: string) => (lang === "en" ? `Field ${id}` : `สนาม ${id}`);

function slot(lang: Lang, r: { fieldId: string; date: string; startHour: number; hours: number }) {
  return `${fieldLabel(lang, r.fieldId)} ${fmtDate(lang, r.date)} ${timeRange(r.startHour, r.hours)}`;
}

function reasonOf(lang: Lang, r: { reasonCode?: string; reason?: string }) {
  return r.reason || (r.reasonCode ? msg(lang, r.reasonCode) : "");
}

function planText(lang: Lang, r: { paymentPlan?: string; payNow?: number; dueAtField?: number }) {
  const plan = r.paymentPlan === "FULL_100" ? (lang === "en" ? "pay in full (100%)" : "จ่ายเต็ม 100%") : lang === "en" ? "50% deposit" : "มัดจำ 50%";
  const now = lang === "en" ? `pay now ${money(lang, r.payNow ?? 0)}` : `จ่ายตอนนี้ ${money(lang, r.payNow ?? 0)}`;
  const due = r.dueAtField ? (lang === "en" ? `, ${money(lang, r.dueAtField)} at the field` : ` เก็บหน้าสนาม ${money(lang, r.dueAtField)}`) : "";
  return `${plan} · ${now}${due}`;
}

export function describeResult(r: ToolResult, lang: Lang): string {
  if (r.tag === "DAY") return describeDay(r, lang);
  if (r.tag === "CHECK") {
    if (r.available) {
      return lang === "en"
        ? `${slot(lang, r)} is available. Field price ${money(lang, r.fieldPrice ?? 0)}. Would you like to book it?`
        : `${slot(lang, r)} ว่างครับ ค่าสนาม ${money(lang, r.fieldPrice ?? 0)} สนใจจองไหมครับ`;
    }
    const alts = (r.alternatives ?? []).map((a) => `${fieldLabel(lang, a.fieldId)} ${String(a.startHour).padStart(2, "0")}:00`).join(", ");
    return lang === "en"
      ? `${slot(lang, r)} is not available (${reasonOf(lang, r)}).${alts ? ` Free slots: ${alts}.` : ""}`
      : `${slot(lang, r)} ไม่ว่างครับ (${reasonOf(lang, r)})${alts ? ` รอบที่ยังว่าง: ${alts}` : ""} ครับ`;
  }
  if (!r.ok) {
    return lang === "en" ? `${slot(lang, r)} can't be booked: ${reasonOf(lang, r)}` : `${slot(lang, r)} จองไม่ได้ครับ: ${reasonOf(lang, r)} ครับ`;
  }
  if (r.tag === "QUOTE") {
    const taken = r.available === false;
    return lang === "en"
      ? `${slot(lang, r)} costs ${money(lang, r.totalPrice ?? 0)} · ${planText(lang, r)}.${taken ? ` Note: this slot is not available right now (${reasonOf(lang, r)}).` : ""}`
      : `${slot(lang, r)} ราคา ${money(lang, r.totalPrice ?? 0)} · ${planText(lang, r)}${taken ? ` · แต่ตอนนี้รอบนี้ไม่ว่าง (${reasonOf(lang, r)})` : ""} ครับ`;
  }
  return lang === "en"
    ? `Summary: ${slot(lang, r)} · ${money(lang, r.totalPrice ?? 0)} · ${planText(lang, r)}. Please tick the PDPA consent on the card below and press "Confirm booking". You then have 15 minutes to pay.`
    : `สรุปการจอง: ${slot(lang, r)} ราคา ${money(lang, r.totalPrice ?? 0)} · ${planText(lang, r)} · กรุณาติ๊กยินยอม PDPA ในการ์ดด้านล่างแล้วกด "ยืนยันการจอง" จากนั้นชำระภายใน 15 นาทีครับ`;
}

/** consecutive start hours as ranges: [11,12,13,15] → "11:00–13:00, 15:00" (start times, not slot ends) */
export function hourRanges(hours: number[]): string {
  const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;
  const out: string[] = [];
  const sorted = [...hours].sort((a, b) => a - b);
  for (let i = 0; i < sorted.length; ) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    out.push(j > i ? `${hh(sorted[i])}–${hh(sorted[j])}` : hh(sorted[i]));
    i = j + 1;
  }
  return out.join(", ");
}

/** S2b: free start hours of every field on one day. No amounts (BR-30) — the evening note only says that 17:00+ uses the evening rate */
function describeDay(r: DayResult, lang: Lang): string {
  const day = fmtDate(lang, r.date);
  if (!r.ok) {
    return lang === "en" ? `I can't list the free slots for ${day}: ${reasonOf(lang, r)}` : `ดูรอบว่างของ ${day} ไม่ได้ครับ: ${reasonOf(lang, r)} ครับ`;
  }
  const fields = r.fields ?? [];
  const any = fields.some((f) => f.free.length > 0);
  if (!any) {
    return lang === "en"
      ? `No free slots left on ${day}. Please pick another day on the Availability page.`
      : `${day} ไม่มีรอบว่างแล้วครับ ลองเลือกวันอื่นที่เมนู ตารางว่าง ครับ`;
  }
  const evening = fields.some((f) => f.free.some((s) => s.evening));
  const parts = fields.map((f) =>
    f.free.length
      ? lang === "en"
        ? `${fieldLabel(lang, f.fieldId)}: ${hourRanges(f.free.map((s) => s.hour))}`
        : `${fieldLabel(lang, f.fieldId)} ${hourRanges(f.free.map((s) => s.hour))}`
      : lang === "en"
        ? `${fieldLabel(lang, f.fieldId)}: full`
        : `${fieldLabel(lang, f.fieldId)} เต็มแล้ว`,
  );
  const note = evening
    ? lang === "en"
      ? " Slots starting from 17:00 use the evening rate."
      : " รอบที่เริ่มตั้งแต่ 17:00 ใช้ราคาเย็นครับ"
    : "";
  return lang === "en"
    ? `Free start times on ${day}: ${parts.join(" · ")}.${note} Tap a time on the card to book it.`
    : `รอบที่ยังว่างของ ${day} (เวลาเริ่ม): ${parts.join(" · ")}${note} แตะเวลาในการ์ดเพื่อจองได้เลยครับ`;
}
