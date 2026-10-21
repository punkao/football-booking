# C3 · Claude Code เรียก tool ของ server football จริง (Lab 7.3)

สถานะ: ⚠ ยังไม่มีการเรียก tool โดย LLM (ดู 'ผลจริง')

## Prompt
```text
วันที่ 14 ตุลาคม 2026 ช่วง 19:00 สนามไหนว่างบ้าง และถ้าเล่น 1 ชั่วโมงที่สนาม B ราคาเท่าไหร่ ตอบเป็นภาษาไทยสั้น ๆ
```

## คำสั่ง (อ่านอย่างเดียว: อนุญาตเฉพาะ 2 tool ไม่มี book)
```bash
claude.exe -p "<prompt ข้างบน>" --mcp-config <football-only.mcp.json> --strict-mcp-config --allowedTools "mcp__football__check_availability,mcp__football__quote" --output-format stream-json --verbose --max-turns 8
# <football-only.mcp.json> = entry "football" ที่ดึงจาก .mcp.json ตรง ๆ (ไม่ปลุก playwright/excalidraw)
# claude.exe = Claude Code 2.1.304 ที่มากับ Claude desktop (ไม่มี claude ใน PATH)
```

## ผลจริง (ลอง 2 ครั้งตามกติกา ทั้งคู่ 401)
- ครั้งที่ 1 (คำถามด้านบน, v2.1.304) และครั้งที่ 2 (`-p "ตอบสั้น ๆ ว่า ok"`, v2.1.299) ล้มด้วยเหตุเดียวกัน: `401 OAuth access token has expired. Re-authenticate to continue.` -> ยังไม่มี LLM ตัวใดเลือกเรียก tool
- สิ่งที่พิสูจน์ได้แล้ว: Claude Code ตัวจริงเปิด server ผ่าน config แล้ว `status: connected` และเห็น 3 tool `mcp__football__*` (system/init ด้านล่าง) = ขั้นค้นพบ (initialize + tools/list) ผ่าน host จริง
- ที่ต้องทำเองเมื่อล็อกอินแล้ว (ผู้ใช้): `claude /login` (หรือเปิดแอป Claude desktop ให้ token ต่ออายุ) แล้วรัน `node tools/mcp-football/run-claude.mjs` (ตั้ง `CLAUDE_BIN` ถ้า `claude` ไม่อยู่ใน PATH) -> ไฟล์นี้จะถูกเขียนทับด้วยลำดับ tool/args/ผลจริง

- Claude Code: model `claude-opus-5-5` · mcp_servers = `[{"name":"football","status":"connected","source":"dynamic"}]`
- tool ที่ host เห็นจาก server: `mcp__football__book`, `mcp__football__check_availability`, `mcp__football__quote`
- api_retry 2 ครั้ง: error_status=401 `authentication_failed`
- tool ที่ LLM เรียก: 0
- คำตอบสุดท้าย (`terminal_reason=api_error`, is_error=true):
```text
Failed to authenticate. API Error: 401 OAuth access token has expired. Re-authenticate to continue.
```

stream-json (ตัด hook ออก): `docs/mcp/football-claude-run.jsonl`
