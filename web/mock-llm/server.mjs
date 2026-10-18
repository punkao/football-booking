// mock-llm (profile "mock") · B1 placeholder: an OpenAI-compatible /v1/chat/completions that always answers the same.
// The deterministic rule-based answers and the slow / error / fake-tag modes are added in round B2.
import { createServer } from "node:http";

const PORT = Number(process.env.PORT || 8080);

createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(JSON.stringify({ ok: true }));
  }
  if (req.method === "POST" && req.url === "/v1/chat/completions") {
    req.resume();
    req.on("end", () => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          id: "mock-1",
          object: "chat.completion",
          model: "mock-llm",
          choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: "mock-llm ยังไม่พร้อม (B1) ครับ" } }],
        }),
      );
    });
    return;
  }
  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: { message: "not found" } }));
}).listen(PORT, "0.0.0.0", () => console.log(`[mock-llm] listening on ${PORT}`));
