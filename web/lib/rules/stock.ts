// Stock rules (pure): BR-33 – BR-38 · T-14 movement direction.
import type { RuleError } from "./schedule.ts";

export const STOCK_LOCATIONS = ["STORE", "COUNTER"] as const;
export type StockLocation = (typeof STOCK_LOCATIONS)[number];
export const STOCK_CATEGORIES = ["RENTAL", "SALE", "EQUIPMENT"] as const;
export const SALE_METHODS = ["CASH", "PROMPTPAY"] as const; // BR-37 / A-30
export type StockAction = "SALE" | "TRANSFER" | "RECEIVE" | "DAMAGE" | "ADJUST" | "REORDER_POINT";
export type StaffRole = "OWNER" | "MANAGER" | "STAFF";

export function isLocation(v: unknown): v is StockLocation {
  return typeof v === "string" && (STOCK_LOCATIONS as readonly string[]).includes(v);
}

/** BR-33: take `qty` out of a place that holds `available` (never below 0) */
export function checkStockOut(available: number, qty: unknown): RuleError | null {
  if (typeof qty !== "number" || !Number.isInteger(qty) || qty < 1) return { code: "INVALID_QTY" };
  if (qty > available) return { code: "STOCK_INSUFFICIENT", params: { available } };
  return null;
}

/** BR-34: different places, enough at the source */
export function checkTransfer(from: unknown, to: unknown, qty: unknown, fromQty: number): RuleError | null {
  if (!isLocation(from) || !isLocation(to)) return { code: "INVALID_LOCATION" };
  if (from === to) return { code: "STOCK_SAME_LOCATION" };
  return checkStockOut(fromQty, qty);
}

/** BR-34: the same amount leaves the source and arrives at the destination (total unchanged) */
export function applyTransfer(levels: Record<StockLocation, number>, from: StockLocation, to: StockLocation, qty: number): Record<StockLocation, number> {
  return { ...levels, [from]: levels[from] - qty, [to]: levels[to] + qty };
}

/** BR-35 / T-06: warn when the total of all places is below the reorder point; no point = no warning */
export function isBelowReorder(total: number, reorderPoint: number | null | undefined, bug = false): boolean {
  if (reorderPoint === null || reorderPoint === undefined) return false;
  return bug ? total <= reorderPoint : total < reorderPoint;
}

/** BR-36 / A-29: STAFF sells and transfers · MANAGER and OWNER do everything */
export function canStockAction(role: StaffRole, action: StockAction): boolean {
  if (role === "OWNER" || role === "MANAGER") return true;
  return role === "STAFF" && (action === "SALE" || action === "TRANSFER");
}

/** BR-36: damage and adjust need a reason */
export function checkReason(reason: unknown): RuleError | null {
  return typeof reason === "string" && reason.trim() !== "" ? null : { code: "STOCK_REASON_REQUIRED" };
}

/** BR-36 / T-14: counted quantity → one ADJUST movement (qty positive, direction by from/to) */
export function adjustMovement(
  location: StockLocation,
  current: number,
  counted: unknown,
): { delta: number; qty: number; fromLocationId: StockLocation | null; toLocationId: StockLocation | null } | RuleError {
  if (typeof counted !== "number" || !Number.isInteger(counted) || counted < 0) return { code: "INVALID_QTY" };
  const delta = counted - current;
  if (delta === 0) return { code: "STOCK_NO_CHANGE" };
  return delta < 0
    ? { delta, qty: -delta, fromLocationId: location, toLocationId: null }
    : { delta, qty: delta, fromLocationId: null, toLocationId: location };
}

/** BR-37: total = Σ unit price × qty */
export function saleTotal(items: { qty: number; unitPrice: number }[]): number {
  return items.reduce((s, x) => s + x.qty * x.unitPrice, 0);
}

/** BR-37 / T-07: only SALE items are sold at the counter */
export function checkSellable(category: string): RuleError | null {
  return category === "SALE" ? null : { code: "STOCK_NOT_FOR_SALE" };
}

/** BR-38 / ADR-18: rentable total of a rental item = its stock in every place */
export function rentableTotal(qtys: number[]): number {
  return qtys.reduce((s, q) => s + Math.max(0, q), 0);
}
