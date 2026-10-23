// mcp-client.mjs — send commands to the running Playwright MCP bridge (mcp-bridge.mjs).
// The bridge keeps one MCP session, so the browser page stays the same between commands.
//
//   node mcp-client.mjs tools                 # tools/list
//   node mcp-client.mjs schema <tool>         # show the inputSchema of one tool
//   node mcp-client.mjs call <tool> '<json>'  # tools/call (refs come from browser_snapshot / browser_find)
//   node mcp-client.mjs smoke [url]           # navigate + snapshot + screenshot, proves it works
//   node mcp-client.mjs stop                  # close the browser and stop the bridge
import fs from 'node:fs';
import path from 'node:path';

const BASE = `http://localhost:${process.env.BRIDGE_PORT ?? 8932}`;
const EVIDENCE = path.resolve(import.meta.dirname, '..', 'docs', 'evidence', 'screenshots', 'mcp');

async function api(method, route, body) {
  const res = await fetch(BASE + route, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  }).catch(() => {
    throw new Error(`bridge not running at ${BASE} — start it with: npm run mcp:bridge`);
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data;
}

/** Print text parts; write image parts to files so they do not flood the console. */
function show(result, label) {
  for (const part of result.content ?? []) {
    if (part.type === 'text') console.log(part.text);
    else if (part.type === 'image') {
      fs.mkdirSync(EVIDENCE, { recursive: true });
      const file = path.join(EVIDENCE, `${label}-${Date.now()}.${part.mimeType?.split('/')[1] ?? 'png'}`);
      fs.writeFileSync(file, Buffer.from(part.data, 'base64'));
      console.log(`[image saved] ${file}`);
    }
  }
  if (result.isError) console.log('[isError: true]');
}

const [cmd, ...rest] = process.argv.slice(2);
try {
  if (cmd === 'tools') {
    for (const t of await api('GET', '/tools')) console.log(`${t.name} — ${t.description}`);
  } else if (cmd === 'schema') {
    console.log(JSON.stringify(await api('GET', `/schema?name=${encodeURIComponent(rest[0])}`), null, 2));
  } else if (cmd === 'call') {
    const [name, json] = rest;
    const result = await api('POST', '/call', { name, arguments: json ? JSON.parse(json) : {} });
    show(result, name);
    process.exitCode = result.isError ? 1 : 0;
  } else if (cmd === 'smoke') {
    const url = rest[0] ?? 'https://playwright.dev';
    for (const [name, args] of [
      ['browser_navigate', { url }],
      ['browser_snapshot', {}],
      ['browser_take_screenshot', { type: 'png', filename: path.join(EVIDENCE, 'smoke.png') }],
    ]) {
      const result = await api('POST', '/call', { name, arguments: args });
      console.log(`\n=== ${name} ${result.isError ? 'FAILED' : 'ok'}`);
      show(result, name);
      if (result.isError) { process.exitCode = 1; break; }
    }
  } else if (cmd === 'stop') {
    console.log(await api('POST', '/shutdown'));
  } else {
    console.log('usage: node mcp-client.mjs tools | schema <tool> | call <tool> <json> | smoke [url] | stop');
    process.exitCode = 2;
  }
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
