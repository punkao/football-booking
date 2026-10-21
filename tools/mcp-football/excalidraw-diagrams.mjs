// excalidraw-diagrams.mjs · ข้อมูลแผนภาพ 3 ภาพของ ลูกหนัง อารีน่า (ใช้กับ excalidraw-run.mjs)
// สี/ขนาดตาม read_diagram_guide ของ server: ฟอนต์ >= 16 · กล่อง >= 120x60 · ช่องห่างลูกศร >= 80 · ลูกศรผูก id · ห้ามใส่ text บนกล่องโซน
const FONT = 2; // helvetica/sans (Liberation Sans ใน server + ฟอนต์ไทยของเครื่องเป็น fallback)
const C = {
  blue: ["#a5d8ff", "#1971c2"],
  purple: ["#eebefa", "#9c36b5"],
  green: ["#b2f2bb", "#2f9e44"],
  orange: ["#ffd8a8", "#e8590c"],
  cyan: ["#99e9f2", "#0c8599"],
  red: ["#ffc9c9", "#e03131"],
  gray: ["#e9ecef", "#868e96"],
  white: ["#ffffff", "#1e1e1e"],
};
const base = { fillStyle: "solid", roughness: 0, strokeWidth: 2, fontFamily: FONT };

/** กล่องมีข้อความ (label ผูกกับกล่อง) */
const box = (id, x, y, w, h, text, color = "white", fontSize = 16, extra = {}) =>
  ({ ...base, id, type: "rectangle", x, y, width: w, height: h, text, fontSize, backgroundColor: C[color][0], strokeColor: C[color][1], ...extra });
const decision = (id, x, y, w, h, text, color = "orange", fontSize = 16) =>
  ({ ...base, id, type: "diamond", x, y, width: w, height: h, text, fontSize, backgroundColor: C[color][0], strokeColor: C[color][1] });
/** โซนพื้นหลัง: ไม่ใส่ text (ป้ายเป็น text แยก) */
const zone = (id, x, y, w, h, color = "gray") =>
  ({ ...base, id, type: "rectangle", x, y, width: w, height: h, backgroundColor: C[color][0], strokeColor: C[color][1], opacity: 45, strokeWidth: 1, strokeStyle: "dashed" });
const label = (id, x, y, text, fontSize = 18, color = "#495057") =>
  ({ ...base, id, type: "text", x, y, text, fontSize, strokeColor: color, strokeWidth: 1 });
const arrow = (id, from, to, text, o = {}) =>
  ({ ...base, id, type: "arrow", x: 0, y: 0, startElementId: from, endElementId: to, ...(text ? { text, fontSize: 14 } : {}), endArrowhead: "arrow", strokeColor: o.color ?? "#1e1e1e", strokeStyle: o.dashed ? "dashed" : "solid", ...(o.start ? { startArrowhead: "arrow" } : {}) });

// ---------------------------------------------------------------- 1 สถาปัตยกรรม
const arch = [
  label("t1", 40, 20, "สถาปัตยกรรมระบบ ลูกหนัง อารีน่า + MCP", 26, "#1e1e1e"),
  zone("zMcp", 400, 130, 320, 630, "purple"),
  label("zMcpL", 416, 140, "MCP servers (stdio · โฟลเดอร์ tools/)", 16, "#9c36b5"),
  zone("zSys", 840, 130, 700, 520, "blue"),
  label("zSysL", 1230, 140, "ระบบจริง (Docker · localhost:3000)", 16, "#1971c2"),
  box("customer", 880, 20, 240, 70, "ลูกค้า (เบราว์เซอร์)", "white"),
  box("host", 40, 380, 220, 110, "Claude Code\nclaude -p\n(Host + MCP Client)", "purple"),
  box("football", 440, 230, 240, 90, "football (ของเรา)\ntools/mcp-football", "orange"),
  box("playwright", 440, 390, 240, 90, "playwright\n@playwright/mcp", "gray"),
  box("excal", 440, 540, 240, 90, "excalidraw\nmcp-excalidraw-server", "gray"),
  box("canvas", 440, 680, 240, 60, "canvas :8892 (เปิดในเบราว์เซอร์)", "white", 14),
  box("web", 880, 230, 280, 110, "Next.js web :3000\nหน้าเว็บ + /api/*", "blue"),
  box("brain", 1320, 230, 200, 110, "สมองแชท\nmock (ค่าเริ่ม)\nai → mock-llm", "gray", 15),
  box("db", 880, 500, 280, 110, "PostgreSQL 16\nfootball-db :5433\nschema 009", "cyan"),
  arrow("a_cust_web", "customer", "web", "HTTP"),
  arrow("a_web_brain", "web", "brain", "ในโปรเซส"),
  arrow("a_web_db", "web", "db", "SQL"),
  arrow("a_host_fb", "host", "football", "stdio"),
  arrow("a_host_pw", "host", "playwright", "stdio"),
  arrow("a_host_ex", "host", "excal", "stdio"),
  arrow("a_fb_web", "football", "web", "HTTP /api"),
  arrow("a_pw_web", "playwright", "web", "คลิกเว็บจริง", { dashed: true }),
  arrow("a_ex_cv", "excal", "canvas", "HTTP/WS", { dashed: true }),
];

// รอบแก้ (เทียบ lab 5.4): football เป็นของที่เราเขียนเอง -> สีเขียว · เพิ่ม client ตัวที่ 2 (test-client.mjs) · ใส่ป้ายกฎความปลอดภัยของ book
const archRevise = [
  {
    update: [
      { id: "football", backgroundColor: C.green[0], strokeColor: C.green[1] },
      { id: "host", text: "Claude Code\nclaude -p\n(Host + MCP Client #1)" },
    ],
  },
  {
    create: [
      box("client2", 40, 230, 220, 90, "test-client.mjs\n(MCP Client #2 ของเรา)", "green"),
      arrow("a_c2_fb", "client2", "football", "stdio"),
      label("guardNote", 436, 166, "book: ต้อง confirm:true +\nlocalhost เท่านั้น · ไม่จ่ายเงิน", 14, "#e03131"),
    ],
  },
];

// ---------------------------------------------------------------- 2 ลำดับการจอง
const flow = [
  label("t2", 40, 20, "ลำดับการจองสนาม · มัดจำ / จ่ายที่สนาม", 26, "#1e1e1e"),
  box("s1", 40, 90, 320, 80, "1. เลือกวัน / สนาม / เวลา\nGET /api/availability", "blue"),
  box("s2", 40, 230, 320, 80, "2. ดูราคา (ค่าสนาม + ของเช่า)\nPOST /api/quote", "blue"),
  box("s3", 40, 370, 320, 90, "3. กรอกชื่อ + เบอร์ + ติ๊กยินยอม\nPOST /api/bookings", "blue"),
  decision("d1", 10, 520, 380, 160, "ยอดสุทธิ = 0 ?\n(ชั่วโมงฟรี/เครดิต)", "orange"),
  box("confirmed0", 520, 575, 300, 60, "CONFIRMED ทันที ไม่ต้องจ่าย", "green"),
  box("pending", 40, 760, 320, 90, "สถานะ PENDING_PAYMENT\nช่วงเวลาถูกล็อก 15 นาที", "orange"),
  decision("d2", 470, 730, 380, 160, "เริ่มเล่น ศ./ส.\nตั้งแต่ 17:00 ?", "orange"),
  box("full", 940, 630, 300, 90, "จ่ายเต็ม 100%\nจ่ายตอนจอง = ยอดสุทธิ", "purple"),
  box("dep", 940, 910, 300, 110, "มัดจำ 50%\nจ่ายตอนจอง = ครึ่งหนึ่ง\nที่เหลือจ่ายที่สนาม", "purple"),
  box("pay", 1340, 770, 340, 100, "จ่าย PromptPay (/pay/<code>)\nภายใน 15 นาที", "blue"),
  box("expired", 1340, 600, 340, 80, "เกินเวลา -> EXPIRED\nช่วงว่างคืนให้คนอื่น", "red"),
  box("confirmed", 1340, 960, 340, 70, "CONFIRMED", "green"),
  box("field", 940, 1100, 400, 110, "วันเล่น: เช็กอินที่สนาม\nจ่ายส่วนที่เหลือที่สนาม (เฉพาะแบบมัดจำ)\n-> CHECKED_IN", "green", 15),
  arrow("f1", "s1", "s2"),
  arrow("f2", "s2", "s3"),
  arrow("f3", "s3", "d1"),
  arrow("f4", "d1", "confirmed0", "ใช่"),
  arrow("f5", "d1", "pending", "ไม่"),
  arrow("f6", "pending", "d2"),
  arrow("f7", "d2", "full", "ใช่"),
  arrow("f8", "d2", "dep", "ไม่"),
  arrow("f9", "full", "pay"),
  arrow("f10", "dep", "pay"),
  arrow("f11", "pay", "confirmed", "จ่ายทัน"),
  arrow("f12", "pay", "expired", "ไม่ทัน", { color: "#e03131", dashed: true }),
  arrow("f13", "confirmed", "field"),
];

// ---------------------------------------------------------------- 3 N x M -> N + M
const nm = [
  label("t3", 40, 20, "N×M → N+M · host ของเรา × server ของเรา", 26, "#1e1e1e"),
  zone("zL", 20, 80, 640, 500, "red"),
  label("zLL", 36, 90, "ก่อน MCP: ต่อกันเอง N×M = 3×3 = 9 ตัวเชื่อม", 18, "#e03131"),
  zone("zR", 700, 80, 740, 500, "green"),
  label("zRL", 716, 90, "หลัง MCP: คุยโปรโตคอลเดียว N+M = 3+3 = 6", 18, "#2f9e44"),
  // ซ้าย
  box("lh1", 40, 160, 220, 80, "Claude Code\n(โต้ตอบ)", "purple"),
  box("lh2", 40, 310, 220, 80, "claude -p\n(headless)", "purple"),
  box("lh3", 40, 460, 220, 80, "สคริปต์ MCP client\n(test-client.mjs)", "purple"),
  box("ls1", 440, 160, 200, 80, "playwright", "gray"),
  box("ls2", 440, 310, 200, 80, "excalidraw", "gray"),
  box("ls3", 440, 460, 200, 80, "football (ของเรา)", "green"),
  // ขวา
  box("rh1", 720, 160, 220, 80, "Claude Code\n(โต้ตอบ)", "purple"),
  box("rh2", 720, 310, 220, 80, "claude -p\n(headless)", "purple"),
  box("rh3", 720, 460, 220, 80, "สคริปต์ MCP client\n(test-client.mjs)", "purple"),
  box("mcp", 1030, 160, 140, 380, "MCP\nJSON-RPC 2.0\ntools/list\ntools/call", "orange"),
  box("rs1", 1250, 160, 170, 80, "playwright", "gray"),
  box("rs2", 1250, 310, 170, 80, "excalidraw", "gray"),
  box("rs3", 1250, 460, 170, 80, "football (ของเรา)", "green"),
  label("note", 40, 610, "เพิ่ม server ตัวที่ 4: ก่อน MCP ต้องเขียนตัวเชื่อมเพิ่ม 3 ชุด (ทุก host) · หลัง MCP เขียน server 1 ตัว ทุก host ใช้ได้เลย", 18, "#1e1e1e"),
];
for (const [h, s] of [["lh1", "ls1"], ["lh1", "ls2"], ["lh1", "ls3"], ["lh2", "ls1"], ["lh2", "ls2"], ["lh2", "ls3"], ["lh3", "ls1"], ["lh3", "ls2"], ["lh3", "ls3"]]) {
  nm.push(arrow(`l_${h}_${s}`, h, s, undefined, { color: "#e03131" }));
}
for (const h of ["rh1", "rh2", "rh3"]) nm.push(arrow(`r_${h}`, h, "mcp", undefined, { color: "#2f9e44" }));
for (const s of ["rs1", "rs2", "rs3"]) nm.push(arrow(`r_${s}`, "mcp", s, undefined, { color: "#2f9e44" }));

export const DIAGRAMS = [
  { no: 1, name: "01-architecture", elements: arch, revise: archRevise },
  { no: 2, name: "02-booking-flow", elements: flow },
  { no: 3, name: "03-n-times-m", elements: nm },
];
