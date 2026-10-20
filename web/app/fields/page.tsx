import Link from "next/link";
import { FieldArt } from "@/components/Art";
import { Ready } from "@/components/ui";
import { fieldName, fmtDate, money, tx } from "@/lib/i18n";
import { ratesOn, todayOf, upcomingRates } from "@/lib/rules";
import { loadFields } from "@/lib/server/data";
import { ensureDb } from "@/lib/server/db";
import { pageLang, pageNow } from "@/lib/server/page";

// FR-30
export default async function FieldsPage() {
  const lang = await pageLang();
  await ensureDb();
  const fields = await loadFields(null);
  const today = todayOf(await pageNow()); // CR-05: price of today + the price that starts later
  return (
    <main className="page container">
      <Ready />
      <h1 className="page-title">{tx(lang, "ข้อมูลสนาม", "Our fields")}</h1>
      <p className="muted">{tx(lang, "หญ้าเทียมคุณภาพดี ไฟสนามสว่างทั่วถึง", "Quality artificial turf with bright floodlights")}</p>
      <div className="cards">
        {fields.map((f) => {
          const cur = ratesOn(f, today);
          const next = upcomingRates(f, today)[0];
          return (
          <article key={f.id} className="card hover field-card" data-testid={`field-card-${f.id}`}>
            <FieldArt
              id={f.id}
              size={f.size}
              covered={f.covered}
              title={tx(
                lang,
                `ภาพวาดสนาม ${f.id} ${f.size} คน ${f.covered ? "มีหลังคา" : "กลางแจ้ง"}`,
                `Drawing of field ${f.id}, ${f.size}-a-side, ${f.covered ? "covered" : "outdoor"}`,
              )}
            />
            <h2 style={{ marginTop: 12 }}>{fieldName(lang, f.id)}</h2>
            <div className="meta">
              <span className="badge light" data-testid={`field-size-${f.id}`} data-value={f.size}>
                {tx(lang, `${f.size} คน`, `${f.size}-a-side`)}
              </span>
              <span className="badge light" data-testid={`field-covered-${f.id}`} data-value={f.covered ? "covered" : "outdoor"}>
                {f.covered ? tx(lang, "มีหลังคา", "Covered") : tx(lang, "กลางแจ้ง", "Outdoor")}
              </span>
            </div>
            <dl className="price-list" style={{ marginTop: 10 }}>
              <div>
                <dt>{tx(lang, "เริ่มก่อน 17:00 (จันทร์–ศุกร์)", "Starts before 17:00 (Mon–Fri)")}</dt>
                <dd data-testid={`field-day-rate-${f.id}`} data-value={cur.dayRate}>
                  {money(lang, cur.dayRate)}
                </dd>
              </div>
              {next && next.dayRate !== cur.dayRate ? (
                <div>
                  <dt>{tx(lang, `ตั้งแต่ ${fmtDate(lang, next.from, false)}`, `From ${fmtDate(lang, next.from, false)}`)}</dt>
                  <dd data-testid={`field-day-rate-next-${f.id}`} data-value={next.dayRate} data-from={next.from}>
                    {money(lang, next.dayRate)}
                  </dd>
                </div>
              ) : null}
              <div>
                <dt>{tx(lang, "ตั้งแต่ 17:00 / เสาร์-อาทิตย์ / วันหยุด", "From 17:00 / weekends / holidays")}</dt>
                <dd data-testid={`field-evening-rate-${f.id}`} data-value={cur.eveningRate}>
                  {money(lang, cur.eveningRate)}
                </dd>
              </div>
              {next && next.eveningRate !== cur.eveningRate ? (
                <div>
                  <dt>{tx(lang, `ตั้งแต่ ${fmtDate(lang, next.from, false)} (ช่วงเย็น / เสาร์-อาทิตย์ / วันหยุด)`, `From ${fmtDate(lang, next.from, false)} (evening / weekends / holidays)`)}</dt>
                  <dd data-testid={`field-evening-rate-next-${f.id}`} data-value={next.eveningRate} data-from={next.from}>
                    {money(lang, next.eveningRate)}
                  </dd>
                </div>
              ) : null}
            </dl>
            <Link href="/book" className="btn small" style={{ marginTop: 12 }} data-testid={`field-book-${f.id}`}>
              {tx(lang, "ดูรอบว่าง", "See free slots")}
            </Link>
          </article>
          );
        })}
      </div>
    </main>
  );
}
