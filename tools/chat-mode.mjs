#!/usr/bin/env node
// Switch the web's chatbot path for tests without anyone reading web/.env:
//   node tools/chat-mode.mjs ai     → MODE=ai through the local mock-llm (compose profile "mock")
//   node tools/chat-mode.mjs mock   → back to MODE=mock (default) and stop mock-llm
// Never points at a real model: LLM_BASE_URL is forced to the mock-llm container.
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const mode = process.argv[2];
if (mode !== "ai" && mode !== "mock") {
  console.error("usage: node tools/chat-mode.mjs ai|mock");
  process.exit(2);
}

const env = Object.fromEntries(
  readFileSync(join(root, "web/.env"), "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const compose = ["compose", "-f", join(root, "web/compose.yaml")];
const run = (args, extra = {}) =>
  execFileSync("docker", args, { stdio: "inherit", env: { ...process.env, ...extra } });

if (mode === "ai") {
  if (!env.MOCK_LLM_TOKEN) {
    console.error("web/.env has no MOCK_LLM_TOKEN (see docs/RUNBOOK.md 2.0)");
    process.exit(1);
  }
  run([...compose, "--profile", "mock", "up", "-d"], {
    MODE: "ai",
    LLM_BASE_URL: "http://mock-llm:8080/v1",
    LLM_API_KEY: env.MOCK_LLM_TOKEN,
  });
} else {
  run([...compose, "up", "-d"], { MODE: "mock", LLM_API_KEY: "" });
  try {
    run(["stop", "football-mock-llm"]);
  } catch {
    /* not running */
  }
}

// wait for healthy + report the mode the web actually runs in
for (let i = 0; i < 60; i++) {
  try {
    const r = await fetch("http://localhost:3000/api/version");
    if (r.ok) {
      const v = await r.json();
      if (v.chatMode === mode) {
        console.log(JSON.stringify(v));
        process.exit(0);
      }
    }
  } catch {
    /* starting */
  }
  await new Promise((r) => setTimeout(r, 2000));
}
console.error(`web did not report chatMode=${mode} within 120 s`);
process.exit(1);
