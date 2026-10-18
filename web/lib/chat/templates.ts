// Fixed sentences for tool results (used by the mock brain and as the BR-30 fallback when a model invents numbers).
import { fmtDate, money, msg, timeRange } from "../i18n.ts";
import type { ToolResult } from "./engine.ts";

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
