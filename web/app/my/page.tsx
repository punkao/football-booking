import { pageCustomer, pageLang } from "@/lib/server/page";
import { MyClient } from "./MyClient";

export default async function MyPage() {
  const lang = await pageLang();
  const c = await pageCustomer();
  return <MyClient lang={lang} loggedIn={!!c} />;
}
