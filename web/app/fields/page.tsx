import Link from "next/link";
import { FieldArt } from "@/components/Art";
import { Ready } from "@/components/ui";
import { fieldName, money, tx } from "@/lib/i18n";
import { loadFields } from "@/lib/server/data";
import { ensureDb } from "@/lib/server/db";
import { pageLang } from "@/lib/server/page";

// FR-30
export default async function FieldsPage() {
  const lang = await pageLang();
  await ensureDb();
  const fields = await loadFields(null);
  return (
    <main className="page container">
      <Ready />
      <h1 className="page-title">{tx(lang, "ข้อมูลสนาม", "Our fields")}</h1>
      <p className="muted">{tx(lang, "หญ้าเทียมคุณภาพดี ไฟสนามสว่างทั่วถึง", "Quality artificial turf with bright floodlights")}</p>
      <div className="cards">
        {fields.map((f) => (
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
                <dd data-testid={`field-day-rate-${f.id}`} data-value={f.dayRate}>
                  {money(lang, f.dayRate)}
                </dd>
              </div>
              <div>
                <dt>{tx(lang, "ตั้งแต่ 17:00 / เสาร์-อาทิตย์ / วันหยุด", "From 17:00 / weekends / holidays")}</dt>
                <dd data-testid={`field-evening-rate-${f.id}`} data-value={f.eveningRate}>
                  {money(lang, f.eveningRate)}
                </dd>
              </div>
            </dl>
            <Link href="/book" className="btn small" style={{ marginTop: 12 }} data-testid={`field-book-${f.id}`}>
              {tx(lang, "ดูรอบว่าง", "See free slots")}
            </Link>
          </article>
        ))}
      </div>
    </main>
  );
}
