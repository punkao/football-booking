import { addDays, todayOf } from "@/lib/rules";
import { pageCustomer, pageLang, pageNow } from "@/lib/server/page";
import { SeriesClient } from "./SeriesClient";

export default async function SeriesPage() {
  const lang = await pageLang();
  const c = await pageCustomer();
  const now = await pageNow();
  return <SeriesClient lang={lang} isMember={!!c?.passwordHash} memberName={c?.name ?? ""} defaultDate={addDays(todayOf(now), 1)} />;
}
