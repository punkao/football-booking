import { pageLang } from "@/lib/server/page";
import { BookClient } from "./BookClient";

export default async function BookPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const lang = await pageLang();
  const sp = await searchParams;
  return <BookClient lang={lang} initialDate={sp.date ?? null} />;
}
