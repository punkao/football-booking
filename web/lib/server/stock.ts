// Stock service (FR-37 – FR-41 · BR-33 – BR-38 · BR-42 / T-16 · 07-SAD 4 "กติกา API v2"):
// every change = one transaction: lock the stock_levels rows → check the rule → change the quantity →
// one StockMovement per item → one AuditLog row.
import {
  SALE_METHODS,
  adjustMovement,
  canAccess,
  canStockAction,
  checkReason,
  checkRentalDecrease,
  maxReserved,
  slotStart,
  todayOf,
  checkSellable,
  checkStockOut,
  checkTransfer,
  isBelowReorder,
  isLocation,
  saleTotal,
} from "@/lib/rules";
import type { StockAction, StockLocation } from "@/lib/rules";
import { stockItemName } from "@/lib/i18n";
import { AppError, fail, num, requireStaff, str } from "./core";
import type { Ctx, StaffRow } from "./core";
import { audit, q, tx } from "./db";
import type { Db } from "./db";

type ItemRow = { id: string; name: string; category: string; unit_price: number | null; reorder_point: number | null };

async function requireStock(ctx: Ctx, action: StockAction): Promise<StaffRow> {
  const s = await requireStaff(ctx, ["STAFF", "MANAGER", "OWNER"]);
  if (!canStockAction(s.role, action)) throw new AppError("FORBIDDEN_ROLE");
  return s;
}

async function loadItem(c: Db, id: unknown): Promise<ItemRow> {
  if (typeof id !== "string") throw new AppError("STOCK_ITEM_NOT_FOUND");
  const r = await c.query("SELECT id, name, category, unit_price, reorder_point FROM stock_items WHERE id = $1", [id]);
  if (!r.rows[0]) throw new AppError("STOCK_ITEM_NOT_FOUND");
  return r.rows[0] as ItemRow;
}

/** SELECT … FOR UPDATE of one item's levels, in a fixed order (STORE, COUNTER) so writers never deadlock */
async function lockLevels(c: Db, itemId: string): Promise<Record<StockLocation, number>> {
  const r = await c.query("SELECT location_id, qty FROM stock_levels WHERE item_id = $1 ORDER BY location_id DESC FOR UPDATE", [itemId]);
  const out: Record<StockLocation, number> = { STORE: 0, COUNTER: 0 };
  for (const row of r.rows as { location_id: StockLocation; qty: number }[]) out[row.location_id] = row.qty;
  return out;
}

async function setLevel(c: Db, itemId: string, loc: StockLocation, qty: number): Promise<void> {
  await c.query(
    `INSERT INTO stock_levels(item_id, location_id, qty) VALUES ($1, $2, $3)
     ON CONFLICT (item_id, location_id) DO UPDATE SET qty = EXCLUDED.qty`,
    [itemId, loc, qty],
  );
}

async function movement(
  c: Db,
  m: { itemId: string; type: string; qty: number; from: StockLocation | null; to: StockLocation | null; reason: string | null; staffId: number; saleId?: number },
  now: Date,
): Promise<void> {
  await c.query(
    `INSERT INTO stock_movements(item_id, type, qty, from_location_id, to_location_id, reason, staff_user_id, counter_sale_id, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [m.itemId, m.type, m.qty, m.from, m.to, m.reason, m.staffId, m.saleId ?? null, now],
  );
}

/** R4: a RENTAL item's new total may not drop below what bookings that have not ended already hold */
async function checkRentalTotal(c: Db, item: ItemRow, newTotal: number, now: Date): Promise<void> {
  if (item.category !== "RENTAL") return;
  const rows = (
    await c.query(
      `SELECT to_char(b.date, 'YYYY-MM-DD') AS date, b.start_hour, b.hours, br.qty, br.returned_qty
         FROM booking_rentals br JOIN bookings b ON b.id = br.booking_id
        WHERE br.item_id = $1 AND b.date >= $2 AND b.status IN ('PENDING_PAYMENT', 'CONFIRMED', 'CHECKED_IN', 'NO_SHOW')`,
      [item.id, todayOf(now)],
    )
  ).rows as { date: string; start_hour: number; hours: number; qty: number; returned_qty: number }[];
  const open = rows.filter((r) => slotStart(r.date, r.start_hour + r.hours).getTime() > now.getTime());
  const reserved = maxReserved(open.map((r) => ({ date: r.date, startHour: r.start_hour, hours: r.hours, qty: r.qty, returnedQty: r.returned_qty })));
  const e = checkRentalDecrease(newTotal, reserved);
  if (e) fail({ ...e, params: { ...e.params, item: item.id } });
}

function intQty(v: unknown): number | undefined {
  const n = num(v);
  return n !== undefined && Number.isInteger(n) ? n : undefined;
}

/** FR-37 / FR-41: every item × place + total · the low-stock warning only for MANAGER / OWNER (BR-44) */
export async function stockOverview(ctx: Ctx) {
  const s = await requireStaff(ctx, ["STAFF", "MANAGER", "OWNER"]);
  const showAlerts = canAccess(s.role, "ALERTS");
  const items = await q<ItemRow & { store: number; counter: number }>(
    `SELECT i.id, i.name, i.category, i.unit_price, i.reorder_point,
            COALESCE(sum(l.qty) FILTER (WHERE l.location_id = 'STORE'), 0)::int AS store,
            COALESCE(sum(l.qty) FILTER (WHERE l.location_id = 'COUNTER'), 0)::int AS counter
       FROM stock_items i LEFT JOIN stock_levels l ON l.item_id = i.id
      GROUP BY i.id ORDER BY array_position(ARRAY['BIB','BALL','WATER','ORS','TOWEL','CONE','NET','LAMP'], i.id)`,
  );
  const list = items.map((i) => {
    const total = i.store + i.counter;
    const base = {
      id: i.id,
      name: stockItemName(ctx.lang, i.id),
      category: i.category,
      unitPrice: i.unit_price,
      reorderPoint: i.reorder_point,
      store: i.store,
      counter: i.counter,
      total,
    };
    return showAlerts ? { ...base, below: isBelowReorder(total, i.reorder_point, ctx.bug) } : base;
  });
  return {
    role: s.role,
    items: list,
    ...(showAlerts ? { alerts: list.filter((i) => (i as { below?: boolean }).below).map((i) => ({ id: i.id, name: i.name, total: i.total, reorderPoint: i.reorderPoint })) } : {}),
  };
}

/** FR-41 (BR-35, BR-44) */
export async function stockAlerts(ctx: Ctx) {
  const s = await requireStaff(ctx, ["STAFF", "MANAGER", "OWNER"]);
  if (!canAccess(s.role, "ALERTS")) throw new AppError("FORBIDDEN_ROLE");
  const o = await stockOverview(ctx);
  return { alerts: o.alerts ?? [] };
}

/** FR-37 / FR-40: who moved what, when (newest first) */
export async function stockMovements(ctx: Ctx, f: { itemId?: string | null; from?: string | null; to?: string | null }) {
  await requireStaff(ctx, ["STAFF", "MANAGER", "OWNER"]);
  const where: string[] = [];
  const params: unknown[] = [];
  if (f.itemId) {
    params.push(f.itemId);
    where.push(`m.item_id = $${params.length}`);
  }
  if (f.from) {
    params.push(f.from);
    where.push(`(m.created_at AT TIME ZONE 'Asia/Bangkok')::date >= $${params.length}::date`);
  }
  if (f.to) {
    params.push(f.to);
    where.push(`(m.created_at AT TIME ZONE 'Asia/Bangkok')::date <= $${params.length}::date`);
  }
  const rows = await q<Record<string, unknown>>(
    `SELECT m.id, m.item_id, m.type, m.qty, m.from_location_id, m.to_location_id, m.reason, m.counter_sale_id, m.created_at,
            s.username, s.name AS staff_name
       FROM stock_movements m JOIN staff_users s ON s.id = m.staff_user_id
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY m.created_at DESC, m.id DESC LIMIT 200`,
    params,
  );
  return {
    movements: rows.map((r) => ({
      id: r.id,
      itemId: r.item_id,
      itemName: stockItemName(ctx.lang, String(r.item_id)),
      type: r.type,
      qty: r.qty,
      // T-14: signed change for reading convenience (ADJUST / DAMAGE / SALE out = negative)
      delta: r.to_location_id && !r.from_location_id ? r.qty : !r.to_location_id ? -Number(r.qty) : 0,
      fromLocationId: r.from_location_id,
      toLocationId: r.to_location_id,
      reason: r.reason,
      counterSaleId: r.counter_sale_id,
      username: r.username,
      staffName: r.staff_name,
      createdAt: r.created_at,
    })),
  };
}

async function levelsOf(c: Db, itemId: string) {
  const r = await c.query("SELECT location_id, qty FROM stock_levels WHERE item_id = $1", [itemId]);
  const out = { STORE: 0, COUNTER: 0 } as Record<StockLocation, number>;
  for (const row of r.rows as { location_id: StockLocation; qty: number }[]) out[row.location_id] = row.qty;
  return { itemId, store: out.STORE, counter: out.COUNTER, total: out.STORE + out.COUNTER };
}

/** FR-38 / BR-33 / BR-37: counter sale (SALE items only, taken from COUNTER only) */
export async function counterSale(ctx: Ctx, b: Record<string, unknown>) {
  const staff = await requireStock(ctx, "SALE");
  const method = str(b.method);
  const merged = new Map<string, number>();
  for (const it of Array.isArray(b.items) ? b.items : []) {
    const id = str((it as { itemId?: unknown })?.itemId);
    const qty = intQty((it as { qty?: unknown })?.qty);
    if (!id) continue;
    if (qty === undefined || qty < 1) throw new AppError("INVALID_QTY");
    merged.set(id, (merged.get(id) ?? 0) + qty);
  }
  if (merged.size === 0) throw new AppError("SALE_EMPTY");
  if (!(SALE_METHODS as readonly string[]).includes(method)) throw new AppError("INVALID_METHOD");
  return tx(async (c) => {
    const lines: { itemId: string; qty: number; unitPrice: number }[] = [];
    for (const id of [...merged.keys()].sort()) {
      const item = await loadItem(c, id);
      fail(checkSellable(item.category) && { code: "STOCK_NOT_FOR_SALE", params: { item: item.id } });
      const lv = await lockLevels(c, item.id);
      const e = checkStockOut(lv.COUNTER, merged.get(id));
      if (e) fail({ ...e, params: { ...e.params, item: item.id } });
      lines.push({ itemId: item.id, qty: merged.get(id)!, unitPrice: item.unit_price ?? 0 });
    }
    const total = saleTotal(lines);
    const sale = await c.query("INSERT INTO counter_sales(total_amount, method, staff_user_id, created_at) VALUES ($1, $2, $3, $4) RETURNING id", [
      total, method, staff.id, ctx.now,
    ]);
    const saleId = sale.rows[0].id as number;
    for (const l of lines) {
      await c.query("INSERT INTO counter_sale_items(sale_id, item_id, qty, unit_price) VALUES ($1, $2, $3, $4)", [saleId, l.itemId, l.qty, l.unitPrice]);
      await c.query("UPDATE stock_levels SET qty = qty - $2 WHERE item_id = $1 AND location_id = 'COUNTER'", [l.itemId, l.qty]);
      await movement(c, { itemId: l.itemId, type: "SALE", qty: l.qty, from: "COUNTER", to: null, reason: null, staffId: staff.id, saleId }, ctx.now);
    }
    await audit(c, staff.id, "STOCK_SALE", `sale ${saleId}`, { method, total, items: lines }, ctx.now);
    const levels = [];
    for (const l of lines) levels.push(await levelsOf(c, l.itemId));
    return { ok: true, sale: { id: saleId, total, method, items: lines }, levels, messageCode: "OK_SALE", messageParams: { amount: total } };
  });
}

/** FR-39 / BR-34 */
export async function stockTransfer(ctx: Ctx, b: Record<string, unknown>) {
  const staff = await requireStock(ctx, "TRANSFER");
  const qty = intQty(b.qty);
  return tx(async (c) => {
    const item = await loadItem(c, b.itemId);
    const lv = await lockLevels(c, item.id);
    const from = str(b.fromLocationId);
    const to = str(b.toLocationId);
    const e = checkTransfer(from, to, qty, isLocation(from) ? lv[from] : 0);
    if (e) fail({ ...e, params: { ...e.params, item: item.id } });
    await setLevel(c, item.id, from as StockLocation, lv[from as StockLocation] - qty!);
    await setLevel(c, item.id, to as StockLocation, lv[to as StockLocation] + qty!);
    await movement(c, { itemId: item.id, type: "TRANSFER", qty: qty!, from: from as StockLocation, to: to as StockLocation, reason: str(b.reason) || null, staffId: staff.id }, ctx.now);
    await audit(c, staff.id, "STOCK_TRANSFER", item.id, { qty, from, to }, ctx.now);
    return { ok: true, levels: await levelsOf(c, item.id), messageCode: "OK_TRANSFER" };
  });
}

/** FR-40 / BR-36 / BR-38: receive (MANAGER, OWNER) */
export async function stockReceive(ctx: Ctx, b: Record<string, unknown>) {
  const staff = await requireStock(ctx, "RECEIVE");
  const qty = intQty(b.qty);
  return tx(async (c) => {
    const item = await loadItem(c, b.itemId);
    const loc = str(b.locationId);
    if (!isLocation(loc)) throw new AppError("INVALID_LOCATION");
    if (qty === undefined || qty < 1) throw new AppError("INVALID_QTY");
    const lv = await lockLevels(c, item.id);
    await setLevel(c, item.id, loc, lv[loc] + qty);
    await movement(c, { itemId: item.id, type: "RECEIVE", qty, from: null, to: loc, reason: str(b.reason) || null, staffId: staff.id }, ctx.now);
    await audit(c, staff.id, "STOCK_RECEIVE", item.id, { qty, location: loc, reason: str(b.reason) || null }, ctx.now);
    return { ok: true, levels: await levelsOf(c, item.id), messageCode: "OK_RECEIVE" };
  });
}

/** FR-40 / BR-33 / BR-36 / BR-38: damaged (reason required) */
export async function stockDamage(ctx: Ctx, b: Record<string, unknown>) {
  const staff = await requireStock(ctx, "DAMAGE");
  const qty = intQty(b.qty);
  fail(checkReason(b.reason));
  return tx(async (c) => {
    const item = await loadItem(c, b.itemId);
    const loc = str(b.locationId);
    if (!isLocation(loc)) throw new AppError("INVALID_LOCATION");
    const lv = await lockLevels(c, item.id);
    const e = checkStockOut(lv[loc], qty);
    if (e) fail({ ...e, params: { ...e.params, item: item.id } });
    await checkRentalTotal(c, item, lv.STORE + lv.COUNTER - qty!, ctx.now);
    await setLevel(c, item.id, loc, lv[loc] - qty!);
    await movement(c, { itemId: item.id, type: "DAMAGE", qty: qty!, from: loc, to: null, reason: str(b.reason), staffId: staff.id }, ctx.now);
    await audit(c, staff.id, "STOCK_DAMAGE", item.id, { qty, location: loc, reason: str(b.reason) }, ctx.now);
    return { ok: true, levels: await levelsOf(c, item.id), messageCode: "OK_DAMAGE" };
  });
}

/** FR-40 / BR-36 / T-14: set the counted quantity (reason required) → ADJUST ± difference */
export async function stockAdjust(ctx: Ctx, b: Record<string, unknown>) {
  const staff = await requireStock(ctx, "ADJUST");
  fail(checkReason(b.reason));
  return tx(async (c) => {
    const item = await loadItem(c, b.itemId);
    const loc = str(b.locationId);
    if (!isLocation(loc)) throw new AppError("INVALID_LOCATION");
    const lv = await lockLevels(c, item.id);
    const counted = intQty(b.countedQty);
    const m = adjustMovement(loc, lv[loc], counted ?? NaN);
    if ("code" in m) fail(m);
    const mv = m as Exclude<typeof m, { code: string }>;
    if (mv.delta < 0) await checkRentalTotal(c, item, lv.STORE + lv.COUNTER + mv.delta, ctx.now);
    await setLevel(c, item.id, loc, counted!);
    await movement(c, { itemId: item.id, type: "ADJUST", qty: mv.qty, from: mv.fromLocationId, to: mv.toLocationId, reason: str(b.reason), staffId: staff.id }, ctx.now);
    await audit(c, staff.id, "STOCK_ADJUST", item.id, { location: loc, before: lv[loc], counted, delta: mv.delta, reason: str(b.reason) }, ctx.now);
    return {
      ok: true,
      delta: mv.delta,
      by: { username: staff.username, name: staff.name },
      at: ctx.now,
      levels: await levelsOf(c, item.id),
      messageCode: "OK_ADJUST",
      messageParams: { delta: (mv.delta > 0 ? "+" : "") + mv.delta },
    };
  });
}

/** FR-40 / BR-35: reorder point (null = no warning) */
export async function stockReorderPoint(ctx: Ctx, itemId: string, b: Record<string, unknown>) {
  const staff = await requireStock(ctx, "REORDER_POINT");
  const raw = b.reorderPoint;
  const rp = raw === null || raw === "" ? null : intQty(raw);
  if (rp === undefined || (rp !== null && rp < 0)) throw new AppError("INVALID_REORDER_POINT");
  return tx(async (c) => {
    const item = await loadItem(c, itemId);
    await c.query("UPDATE stock_items SET reorder_point = $2 WHERE id = $1", [item.id, rp]);
    await audit(c, staff.id, "REORDER_POINT", item.id, { before: item.reorder_point, after: rp }, ctx.now);
    return { ok: true, itemId: item.id, reorderPoint: rp, messageCode: "OK_REORDER_POINT" };
  });
}
