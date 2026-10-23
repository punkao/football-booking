# 00 · Environment (เฟส 0)

ตรวจและติดตั้งบนเครื่องจริง 2026-10-09 (Windows 11, Claude desktop app แท็บ Code) ทุกค่ามาจากคำสั่งที่รันจริง

## เครื่องมือ

| รายการ | ผล | หมายเหตุ |
|---|---|---|
| Node.js / npm | v24.20.0 / 11.19.0 | ตรงกับ `node:24` ที่บทเรียนใช้ |
| Docker Desktop / Compose | 29.8.0 / v5.5.1 | daemon ทำงาน |
| ffmpeg | 9.0 (gyan.dev) | ใช้ทำ GIF/MP4 |
| git | 2.55.0 | |
| `claude` CLI | **ไม่มี** | ใช้ `claude mcp add` แบบบทเรียนไม่ได้ → ดูหัวข้อ Playwright MCP |
| พอร์ต 3000 / 5432 / 8932 | ว่าง | |
| ดิสก์ | C เหลือ 716 GB · D เหลือ 633 GB | |

## แพ็กเกจที่ติดตั้ง (`tools/`, ล็อกรุ่นตายตัว)

| แพ็กเกจ | รุ่น | ใช้ทำ |
|---|---|---|
| `@playwright/mcp` | 0.0.83 | ให้ AI ใช้เว็บเหมือนคนจริง (ภายในใช้ playwright `1.64.0-alpha-1790635538000`) |
| `@playwright/test` | 1.64.0 | test อัตโนมัติ 3 เบราว์เซอร์ (`e2e/` ต้องใช้รุ่นเดียวกัน) |
| `@modelcontextprotocol/sdk` | 1.32.1 | MCP client ของ bridge |
| `cross-env` | 10.1.0 | ตั้ง env ใน npm script บน Windows |

## เบราว์เซอร์ (`D:\ms-playwright`)

| ใช้กับ | เบราว์เซอร์ |
|---|---|
| `@playwright/test` 1.64.0 | chromium-1248 (156.0.8078.4) · chromium_headless_shell-1248 · firefox-1555 (157.0) · webkit-2370 (27.2) · ffmpeg-1013 |
| `@playwright/mcp` 0.0.83 | chromium-1247 (155.0.8059.12) · chromium_headless_shell-1247 · ffmpeg-1011 |

ทดสอบเปิดจริงผ่านทั้ง 5 แบบ: test chromium / firefox / webkit (headless), test chromium headed, mcp chromium headed

## ปัญหาที่เจอจริง และวิธีแก้

| # | อาการ | สาเหตุ (ยืนยันแล้ว) | แก้ |
|---|---|---|---|
| 1 | `curl -6 https://cdn.playwright.dev` → 000 | IPv6 ของเครื่องใช้ไม่ได้ (IPv4 ได้) — อาการเดียวกับ 00_tester/01 LAB 3 | ดาวน์โหลดด้วย `NODE_OPTIONS=--dns-result-order=ipv4first` |
| 2 | MCP 0.0.83 กับ Test 1.64.0 ต้องการ chromium คนละ revision (1247 vs 1248) | MCP ผูก playwright รุ่น alpha — อาการเดียวกับ 00_tester/03 LAB 7 | ติดตั้งเบราว์เซอร์ทั้งสองชุด · ล็อกรุ่นใน package.json |
| 3 | `spawn UNKNOWN` / "side-by-side configuration is incorrect" เปิด chrome.exe (headed) และ firefox.exe ไม่ได้ | Event log `SideBySide`: หา dependent assembly ไม่เจอเมื่อ path มีช่องว่าง (`C:\Users\Windows 11\...`) · copy ไป path ไม่มีช่องว่างแล้วเปิดได้ทันที | ย้ายเบราว์เซอร์ไป `D:\ms-playwright` + ตั้ง `PLAYWRIGHT_BROWSERS_PATH` (ใน npm script, bridge, `.mcp.json` — ไม่แก้ env ของเครื่อง) |
| 4 | Playwright MCP แบบ HTTP ตอบ 403 "Access is only allowed at localhost:8931" | server ตรวจ Host header | ใช้ `localhost` ไม่ใช่ `127.0.0.1` |
| 5 | MCP แบบ HTTP: คำสั่งถัดไปได้หน้า `about:blank` / `Ref e44 not found` | session ใหม่ต่อคำสั่ง + การต่อ session เดิมไม่นิ่ง | เปลี่ยนเป็น **bridge** ถือ MCP session เดียวผ่าน stdio (`tools/mcp-bridge.mjs`) |
| 6 | `browser_click {"ref": ...}` → Invalid input | MCP 0.0.83 ใช้พารามิเตอร์ `target` แทน `ref` | ดู schema ก่อนเรียก: `node mcp-client.mjs schema <tool>` |
| 7 | Git Bash: `docker run -v ...:/mnt/docs` ได้ path แปลก | Git Bash แปลง path เอง (MSYS) | `MSYS_NO_PATHCONV=1` · ใน compose ใช้ path relative ได้ปกติ |

## Playwright MCP ในแชตนี้ (ไม่มี `claude` CLI)

แชตที่เปิดอยู่โหลด MCP server ใหม่กลางทางไม่ได้ จึงใช้ **bridge**:

```text
Claude (แชตนี้) ──shell──▶ mcp-client.mjs ──HTTP localhost:8932──▶ mcp-bridge.mjs ══MCP stdio══▶ @playwright/mcp ──▶ Chromium (headed, isolated)
```

- `npm run mcp:bridge` (ใน `tools/`) เปิด bridge + หน้าต่างเบราว์เซอร์
- `node mcp-client.mjs call <tool> '<json>'` ส่ง `tools/call` จริงตามโปรโตคอล MCP
- ทุก call ถูกบันทึกใน `docs/evidence/screenshots/mcp/trace.jsonl` (tool, arguments, isError, ms, ผลย่อ)
- เซสชันใหม่ในอนาคต: `.mcp.json` ที่ root ตั้งค่า server เดียวกันแบบ stdio (รอการยืนยันว่าแท็บ Code โหลดได้)

## หลักฐาน smoke test (ทุกขั้นข้ามคำสั่ง shell คนละครั้ง ใช้ session เดียวกัน)

| เวลา (UTC) | tool | ผล |
|---|---|---|
| 12:30:27 | `browser_navigate` https://playwright.dev | ok · title "Fast and reliable end-to-end testing…" |
| 12:30:27 | `browser_find` "Get started" | ok · `link "Get started" [ref=e44]` |
| 12:30:35 | `browser_click` target e44 | ok · ไปหน้า `/docs/intro` "Installation" |
| 12:30:36 | `browser_take_screenshot` | `docs/evidence/screenshots/mcp/phase0-after-click.png` |

## Docker กับ path ที่มีช่องว่าง

| ทดสอบ | ผล |
|---|---|
| `docker compose` build context ใน `D:\work (outside)\...` | ✅ |
| compose mount `.` แบบ read-only (แบบที่ portal จะใช้) | ✅ อ่านไฟล์ได้ |
