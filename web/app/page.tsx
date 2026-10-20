import Link from "next/link";
import { FieldArt, PitchLines } from "@/components/Art";
import { Ready } from "@/components/ui";
import { SEED_FIELDS } from "@/lib/server/schema";
import { fieldName, money, nextRateText, tx } from "@/lib/i18n";
import { ratesOn, todayOf, upcomingRates } from "@/lib/rules";
import { pageLang, pageNowOrMachine } from "@/lib/server/page";

export default async function HomePage() {
  const lang = await pageLang();
  const today = todayOf(await pageNowOrMachine()); // CR-05: the card shows the price of today + the price that starts later
  return (
    <main>
      <Ready />
      <section className="hero">
        <PitchLines />
        <div className="container hero-inner">
          <div>
            <span className="badge">⚽ {tx(lang, "หญ้าเทียม 3 สนาม · เปิด 08:00–24:00", "3 turf fields · open 08:00–24:00")}</span>
            <h1
              data-testid="home-title"
              aria-label={tx(lang, "เตะใต้แสงไฟสนาม จองง่ายในไม่กี่แตะ", "Kick off under the floodlights")}
            >
              {lang === "en" ? (
                <>
                  Kick off under <em>the floodlights</em>
                </>
              ) : (
                <>
                  เตะใต้<em>แสงไฟสนาม</em> จองง่ายในไม่กี่แตะ
                </>
              )}
            </h1>
            <p className="lead">
              {tx(
                lang,
                "ดูรอบว่างของทั้ง 3 สนามแบบเรียลไทม์ จองและจ่ายผ่านพร้อมเพย์ได้ทันที ไม่ต้องสมัครสมาชิก",
                "See free slots on all three fields in real time, book and pay by PromptPay right away — no sign-up needed.",
              )}
            </p>
            <div className="hero-cta">
              <Link href="/book" className="btn yellow" data-testid="cta-today">
                {tx(lang, "ดูสนามว่างวันนี้", "See today's free slots")}
              </Link>
              <Link href="/my" className="btn ghost on-dark" data-testid="cta-my">
                {tx(lang, "ดูการจองของฉัน", "My bookings")}
              </Link>
            </div>
            <div className="hero-badges">
              <span className="badge">{tx(lang, "จองล่วงหน้าได้ 14 วัน", "Book up to 14 days ahead")}</span>
              <span className="badge">{tx(lang, "มัดจำ 50%", "50% deposit")}</span>
              <span className="badge">{tx(lang, "ทุก 10 ชั่วโมง ฟรี 1 ชั่วโมง", "1 free hour every 10 hours")}</span>
            </div>
          </div>
          <div className="hero-art">
            <FieldArt id="C" size={7} covered title={tx(lang, "ภาพวาดสนาม C 7 คน มีหลังคา", "Drawing of field C, 7-a-side, covered")} />
          </div>
        </div>
      </section>

      <div className="container">
        <div className="section-title">
          <h2>{tx(lang, "สนามของเรา", "Our fields")}</h2>
          <Link href="/fields" data-testid="link-fields">
            {tx(lang, "ดูรายละเอียดสนาม", "Field details")} →
          </Link>
        </div>
        <div className="cards">
          {SEED_FIELDS.map((f) => {
            const cur = ratesOn(f, today);
            const next = upcomingRates(f, today)[0];
            const nextText = next ? nextRateText(lang, cur, next) : "";
            return (
            <article key={f.id} className="card hover field-card" data-testid={`home-field-${f.id}`}>
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
              <h3 style={{ marginTop: 12 }}>{fieldName(lang, f.id)}</h3>
              <div className="meta">
                <span className="badge light">{tx(lang, `${f.size} คน`, `${f.size}-a-side`)}</span>
                <span className="badge light">{f.covered ? tx(lang, "มีหลังคา", "Covered") : tx(lang, "กลางแจ้ง", "Outdoor")}</span>
              </div>
              <p className="muted small" style={{ marginBottom: 0 }}>
                {tx(lang, "ก่อน 17:00", "Before 17:00")} {money(lang, cur.dayRate)} · {tx(lang, "ตั้งแต่ 17:00 / เสาร์-อาทิตย์ / วันหยุด", "From 17:00 / weekends / holidays")}{" "}
                {money(lang, cur.eveningRate)} {tx(lang, "ต่อชั่วโมง", "per hour")}
                {next && nextText ? (
                  <>
                    {" "}
                    <span data-testid={`home-field-${f.id}-next-rate`} data-value={next.eveningRate} data-day-value={next.dayRate} data-from={next.from}>
                      ({nextText})
                    </span>
                  </>
                ) : null}
              </p>
            </article>
            );
          })}
        </div>

        <div className="section-title">
          <h2>{tx(lang, "จองใน 3 ขั้น", "Book in 3 steps")}</h2>
        </div>
        <div className="cards">
          {[
            [tx(lang, "1. เลือกรอบ", "1. Pick a slot"), tx(lang, "เลือกวันและรอบว่างจากตาราง", "Choose a day and a free slot")],
            [tx(lang, "2. กรอกชื่อ + เบอร์", "2. Name + phone"), tx(lang, "ไม่ต้องสมัครสมาชิก ติ๊กยินยอม PDPA", "No sign-up, just PDPA consent")],
            [tx(lang, "3. จ่ายพร้อมเพย์", "3. Pay by PromptPay"), tx(lang, "สแกนจ่ายภายใน 15 นาที รับรหัสการจองทันที", "Pay within 15 minutes and get your code")],
          ].map(([t, d]) => (
            <div key={t} className="card">
              <h3>{t}</h3>
              <p className="muted" style={{ margin: 0 }}>
                {d}
              </p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
