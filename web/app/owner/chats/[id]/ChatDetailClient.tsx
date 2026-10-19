"use client";

import Link from "next/link";
import { BackTabs, useLoad } from "@/components/BackOffice";
import { ErrorBox, Ready } from "@/components/ui";
import { fmtDateTime, tx } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n";

type Data = {
  chat: { ref: string; lang: string; createdAt: string; lastMessageAt: string; customerPhone: string | null };
  messages: { id: number; role: "USER" | "BOT"; text: string; bookingCode: string | null; createdAt: string }[];
};

// FR-36 · BR-45: messages of one room, phones masked · links to bookings the chatbot made
export function ChatDetailClient({ lang, role, id }: { lang: Lang; role: string; id: string }) {
  const { data, error, busy } = useLoad<Data>(lang, `/api/owner/chats/${encodeURIComponent(id)}`);
  return (
    <main className="page container">
      <Ready when={!busy && (!!data || !!error)} />
      <h1 className="page-title">{tx(lang, "ห้องแชท", "Chat room")}</h1>
      <BackTabs lang={lang} role={role} />
      <p>
        <Link href="/owner/chats" data-testid="chat-detail-back">
          ← {tx(lang, "ประวัติแชท", "Chat history")}
        </Link>
      </p>
      <ErrorBox message={error} />
      {data && (
        <section className="card">
          <p className="small muted" style={{ marginTop: 0 }}>
            {fmtDateTime(lang, data.chat.createdAt)} · {data.chat.lang.toUpperCase()} {data.chat.customerPhone ? `· ${data.chat.customerPhone}` : ""}
          </p>
          <div className="chat-log" style={{ maxHeight: "none", background: "none", padding: 0 }} data-testid="chat-detail" data-count={data.messages.length}>
            {data.messages.map((m, i) => (
              <div key={m.id} className={`chat-msg ${m.role === "USER" ? "user" : "bot"}`} data-testid={`chat-detail-msg-${i}`} data-role={m.role}>
                {m.text}
                {m.bookingCode && (
                  <div className="small">
                    <Link href={`/owner/bookings/${m.bookingCode}`} data-testid={`chat-detail-booking-${m.bookingCode}`}>
                      {m.bookingCode}
                    </Link>
                  </div>
                )}
                <div className="small" style={{ opacity: 0.7 }}>
                  {fmtDateTime(lang, m.createdAt)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
