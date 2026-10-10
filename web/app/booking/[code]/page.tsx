import { pageLang } from "@/lib/server/page";
import { BookingClient } from "./BookingClient";

export default async function BookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { code } = await params;
  const sp = await searchParams;
  return <BookingClient lang={await pageLang()} code={decodeURIComponent(code)} done={sp.done ?? null} />;
}
