// mcp-bridge.mjs — holds ONE Playwright MCP session open (stdio, like Claude Code does)
// and exposes it on http://localhost:8932 so short-lived shell commands can drive the same
// browser page step by step, like a real user. Every tools/call is logged to
// ../screenshots/mcp/trace.jsonl as evidence.
//
//   npm run mcp:bridge          # start (headed browser window)
//   npm run mcp:bridge:headless # start without a window
//   node mcp-client.mjs ...     # then send commands (see mcp-client.mjs)
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const PORT = Number(process.env.BRIDGE_PORT ?? 8932);
const HERE = import.meta.dirname;
const EVIDENCE = path.resolve(HERE, '..', 'screenshots', 'mcp');
fs.mkdirSync(EVIDENCE, { recursive: true });

const args = [
  path.join(HERE, 'node_modules', '@playwright', 'mcp', 'cli.js'),
  '--isolated', '--browser', 'chromium', '--viewport-size', '1280x800', '--output-dir', EVIDENCE,
  ...(process.argv.includes('--headless') ? ['--headless'] : []),
];
const transport = new StdioClientTransport({
  command: process.execPath,
  args,
  // Browsers live in a path WITHOUT spaces: Windows refuses to start chrome.exe/firefox.exe
  // from "C:\Users\Windows 11\..." (SxS "side-by-side configuration is incorrect").
  env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH ?? 'D:\\ms-playwright' },
  stderr: 'inherit',
});
const client = new Client({ name: 'football-booking-bridge', version: '1.0.0' });
await client.connect(transport);
const { tools } = await client.listTools();

const log = (entry) =>
  fs.appendFileSync(path.join(EVIDENCE, 'trace.jsonl'), JSON.stringify({ at: new Date().toISOString(), ...entry }) + '\n');

const send = (res, code, body) => {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
};

http
  .createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://localhost:${PORT}`);
      if (req.method === 'GET' && url.pathname === '/tools') {
        return send(res, 200, tools.map((t) => ({ name: t.name, description: (t.description ?? '').split('\n')[0] })));
      }
      if (req.method === 'GET' && url.pathname === '/schema') {
        const tool = tools.find((t) => t.name === url.searchParams.get('name'));
        return tool ? send(res, 200, tool.inputSchema) : send(res, 404, { error: 'no such tool' });
      }
      if (req.method === 'POST' && url.pathname === '/call') {
        let raw = '';
        for await (const chunk of req) raw += chunk;
        const { name, arguments: a = {} } = JSON.parse(raw);
        const t0 = Date.now();
        const result = await client.callTool({ name, arguments: a });
        const text = (result.content ?? []).filter((p) => p.type === 'text').map((p) => p.text).join('\n');
        log({ tool: name, arguments: a, isError: !!result.isError, ms: Date.now() - t0, result: text.slice(0, 400) });
        return send(res, 200, result);
      }
      if (req.method === 'POST' && url.pathname === '/shutdown') {
        send(res, 200, { ok: true });
        await client.close();
        process.exit(0);
      }
      send(res, 404, { error: 'unknown route' });
    } catch (e) {
      send(res, 500, { error: String(e?.message ?? e) });
    }
  })
  .listen(PORT, 'localhost', () => console.log(`bridge ready on http://localhost:${PORT} (${tools.length} tools)`));
