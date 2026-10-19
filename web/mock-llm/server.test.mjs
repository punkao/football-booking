// R10 (written first): mock-llm only answers a non-empty Bearer token equal to MOCK_LLM_TOKEN.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const brain = pathToFileURL(path.join(here, "../lib/chat/mock.ts")).href;

async function start(env) {
  const port = 18000 + Math.floor(Math.random() * 1000);
  const child = spawn(process.execPath, [path.join(here, "server.mjs")], { env: { ...process.env, ...env, PORT: String(port), BRAIN_PATH: brain }, stdio: "pipe" });
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) break;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  return { url: `http://127.0.0.1:${port}/v1/chat/completions`, stop: () => child.kill() };
}

const body = JSON.stringify({ messages: [{ role: "system", content: 'FACTS: {"today":"2026-10-09","fields":[],"contact":{"phone":"02-345-6789","line":"@lookhnang"}}' }, { role: "user", content: "What time do you open?" }] });
const call = (url, auth) => fetch(url, { method: "POST", headers: { "content-type": "application/json", ...(auth === undefined ? {} : { authorization: auth }) }, body });

test("R10 token required: none / empty / wrong → 401 · right → 200", async () => {
  const s = await start({ MOCK_LLM_TOKEN: "right-token-123" });
  try {
    assert.equal((await call(s.url)).status, 401);
    assert.equal((await call(s.url, "Bearer ")).status, 401);
    assert.equal((await call(s.url, "Bearer wrong")).status, 401);
    const ok = await call(s.url, "Bearer right-token-123");
    assert.equal(ok.status, 200);
    assert.match((await ok.json()).choices[0].message.content, /08:00/);
  } finally {
    s.stop();
  }
});

test("R10 no MOCK_LLM_TOKEN configured → nothing is answered", async () => {
  const s = await start({ MOCK_LLM_TOKEN: "" });
  try {
    assert.equal((await call(s.url, "Bearer anything")).status, 401);
  } finally {
    s.stop();
  }
});
