// mock-llm (compose profile "mock") · an OpenAI-compatible fake model for MODE=ai tests (07-SAD 7 · ADR-16).
// POST /v1/chat/completions answers with the SAME deterministic brain as MODE=mock (web/lib/chat/mock.ts, mounted
// read-only at /srv/lib), so the ai code path (HTTP, Bearer token, timeout, tags, <think>) is exercised for free.
// Test switches inside the customer's last message (plain words, not tags):
//   #slow    → answer after MOCK_SLOW_MS (default 65 000 ms, longer than the web's 60 s timeout → apology)
//   #error   → HTTP 500
//   #faketag → a reply with a broken / unknown tag (must do nothing, must be hidden)
//   #think   → the normal answer wrapped after a <think>…</think> block (must be removed)
import { createServer } from "node:http";

const { mockBrain } = await import(process.env.BRAIN_PATH || "/srv/lib/chat/mock.ts");
const PORT = Number(process.env.PORT || 8080);
const SLOW_MS = Number(process.env.MOCK_SLOW_MS || 65_000);

function send(res, status, obj) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(obj));
}

function lastCustomerText(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === "user" && !String(m.content).startsWith("[RESULT]")) return String(m.content);
  }
  return "";
}

createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") return send(res, 200, { ok: true });
  if (req.method !== "POST" || req.url !== "/v1/chat/completions") return send(res, 404, { error: { message: "not found" } });
  if (!/^Bearer\s+\S*/.test(req.headers.authorization ?? "")) return send(res, 401, { error: { message: "missing bearer token" } });
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", async () => {
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      return send(res, 400, { error: { message: "bad json" } });
    }
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const text = lastCustomerText(messages);
    const toolRound = String(messages[messages.length - 1]?.content ?? "").startsWith("[RESULT]");
    if (text.includes("#error")) return send(res, 500, { error: { message: "mock failure" } });
    if (text.includes("#slow")) await new Promise((r) => setTimeout(r, SLOW_MS));
    let content;
    if (text.includes("#faketag") && !toolRound) content = 'ขอตรวจให้ครับ [BOOK]{"fieldId":"Z","price":1} [CANCEL]{"code":"LN-900004"} [QUOTE]{"fieldId":"C",';
    else content = mockBrain(messages);
    if (text.includes("#think")) content = `<think>internal reasoning that must never be shown</think>${content}`;
    send(res, 200, {
      id: "mock-" + Date.now(),
      object: "chat.completion",
      model: body.model || "mock-llm",
      choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content } }],
    });
  });
}).listen(PORT, "0.0.0.0", () => console.log(`[mock-llm] listening on ${PORT}`));
