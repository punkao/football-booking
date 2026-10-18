"use client";

import Link from "next/link";
import { BackTabs, useLoad } from "@/components/BackOffice";
import { EmptyNet } from "@/components/Art";
import { ErrorBox, Ready } from "@/components/ui";
import { fmtDateTime, tx } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n";

type Row = { id: string; lang: string; createdAt: string; lastMessageAt: string; messages: number; firstText: string; bookingCodes: string[]; customerPhone: string | null };

// FR-36 · BR-45: chat rooms (newest first) · phone numbers masked (08x-xxx-1234) · read only
export function ChatsClient({ lang, role }: { lang: Lang; role: string }) {
  const { data, error, busy } = useLoad<{ chats: Row[] }>(lang, "/api/owner/chats");
  return (
    <main className="page container">
      <Ready when={!busy && !!data} />
      <h1 className="page-title">{tx(lang, "ประวัติแชท", "Chat history")}</h1>
      <BackTabs lang={lang} role={role} />
      <p className="small muted">
        {tx(lang, "เก็บ 90 วัน หลังจากนั้นชื่อและเบอร์ในข้อความถูกลบ · เบอร์แสดงแบบปิดบางส่วน", "Kept 90 days, then names and phone numbers are removed · phones are partly hidden")}
      </p>
      <ErrorBox message={error} />
      {data && data.chats.length === 0 && (
        <p className="muted" data-testid="chat-list-empty">
          <EmptyNet title={tx(lang, "ยังไม่มีแชท", "No chats yet")} /> {tx(lang, "ยังไม่มีแชท", "No chats yet")}
        </p>
      )}
      {data && data.chats.length > 0 && (
        <div className="table-wrap card">
          <table className="data-table" data-testid="chat-list" data-count={data.chats.length}>
            <thead>
              <tr>
                <th>{tx(lang, "ล่าสุด", "Last message")}</th>
                <th>{tx(lang, "ข้อความแรก", "First message")}</th>
                <th className="num">{tx(lang, "ข้อความ", "Messages")}</th>
                <th>{tx(lang, "การจองจากแชท", "Bookings")}</th>
                <th>{tx(lang, "ภาษา", "Language")}</th>
              </tr>
            </thead>
            <tbody>
              {data.chats.map((c) => (
                <tr key={c.id} data-testid={`chat-row-${c.id}`}>
                  <td>
                    <Link href={`/owner/chats/${c.id}`} data-testid={`chat-link-${c.id}`}>
                      {fmtDateTime(lang, c.lastMessageAt)}
                    </Link>
                    {c.customerPhone && <div className="small muted">{c.customerPhone}</div>}
                  </td>
                  <td className="mono-break">{c.firstText}</td>
                  <td className="num">{c.messages}</td>
                  <td>{c.bookingCodes.join(", ") || "–"}</td>
                  <td>{c.lang.toUpperCase()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
