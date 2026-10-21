import fs from "node:fs";
import path from "node:path";

const OUT = "D:/work (outside)/Chanwacnich_TA/football-booking/docs/ui/mockups";
const FONTS = "D:/work (outside)/Chanwacnich_TA/football-booking/web/node_modules/@fontsource";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const base = fs.readFileSync(path.join(HERE, "base.css"), "utf8");

const b64 = (p) => fs.readFileSync(path.join(FONTS, p)).toString("base64");
const face = (family, weight, file, range) =>
  `@font-face{font-family:"${family}";font-weight:${weight};font-style:normal;font-display:swap;src:url(data:font/woff2;base64,${b64(file)}) format("woff2");unicode-range:${range};}`;
const LATIN = "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD";
const THAI = "U+02D7,U+0303,U+0331,U+0E01-0E5B,U+200C-200D,U+25CC";
const fonts = [
  face("Prompt", 600, "prompt/files/prompt-latin-600-normal.woff2", LATIN),
  face("Prompt", 600, "prompt/files/prompt-thai-600-normal.woff2", THAI),
  face("IBM Plex Sans Thai", 400, "ibm-plex-sans-thai/files/ibm-plex-sans-thai-latin-400-normal.woff2", LATIN),
  face("IBM Plex Sans Thai", 400, "ibm-plex-sans-thai/files/ibm-plex-sans-thai-thai-400-normal.woff2", THAI),
  face("IBM Plex Sans Thai", 600, "ibm-plex-sans-thai/files/ibm-plex-sans-thai-latin-600-normal.woff2", LATIN),
  face("IBM Plex Sans Thai", 600, "ibm-plex-sans-thai/files/ibm-plex-sans-thai-thai-600-normal.woff2", THAI),
].join("\n");

const page = (title, css, body, script = "") => `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
${fonts}
${base}
${css}
</style>
</head>
<body>
${body}
${script ? `<script>${script}</script>` : ""}
</body>
</html>
`;

const logo = (s = 36) => `<svg width="${s}" height="${s}" viewBox="0 0 64 64" role="img" aria-label="โลโก้ลูกหนัง อารีน่า"><circle cx="32" cy="32" r="30" fill="#0f7a3e" stroke="#ffd23f" stroke-width="3"/><path d="M2 32h60" stroke="#f4f8f5" stroke-width="2" opacity=".8"/><circle cx="32" cy="32" r="10" fill="none" stroke="#f4f8f5" stroke-width="2" opacity=".8"/><circle cx="32" cy="32" r="7" fill="#ffd23f" stroke="#0a3b2c" stroke-width="1.5"/><path d="M32 27l4 3-1.5 4.5h-5L28 30z" fill="#0a3b2c"/></svg>`;
const icoCheck = `<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3.2L13 5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const icoX = `<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`;
const icoWarn = `<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="currentColor"/><path d="M8 4.5v4.2M8 10.8v.8" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></svg>`;
const icoBot = (s = 36) => `<svg width="${s}" height="${s}" viewBox="0 0 40 40" role="img" aria-label="น้องบอล"><circle cx="20" cy="20" r="19" fill="#ffd23f"/><circle cx="20" cy="20" r="15" fill="#f4f8f5"/><path d="M20 12l5 3.6-1.9 5.8h-6.2l-1.9-5.8z" fill="#0a3b2c"/><circle cx="14.5" cy="24" r="1.6" fill="#0a3b2c"/><circle cx="25.5" cy="24" r="1.6" fill="#0a3b2c"/></svg>`;
const icoChat = `<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`;

const navCustomer = (active = "หน้าแรก") =>
  ["หน้าแรก", "ตารางว่าง", "สนาม", "หาคู่แข่ง", "จองประจำ", "การจองของฉัน", "พนักงาน"]
    .map((t) => `<a href="#"${t === active ? ' aria-current="page"' : ""}>${t}</a>`)
    .join("");
const header = (active, extra = "") => `<header class="masthead"><div class="container bar">
  <a class="brand" href="#">${logo(34)}<span>ลูกหนัง อารีน่า</span></a>
  <nav class="nav" aria-label="เมนูหลัก">${navCustomer(active)}</nav>
  ${extra}
  <div class="lang" role="group" aria-label="ภาษา"><button aria-pressed="true">TH</button><button aria-pressed="false">EN</button></div>
  <button class="menu-btn" aria-expanded="false"><svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M2 4.5h14M2 9h14M2 13.5h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>เมนู</button>
</div></header>`;

const miniPitch = (w, c = false) => `<svg width="${w}" height="${Math.round(w * 0.64)}" viewBox="0 0 100 64" aria-hidden="true"><rect width="100" height="64" rx="6" fill="#0a3b2c"/><rect x="6" y="6" width="88" height="52" fill="#0f7a3e"/><g fill="none" stroke="#f4f8f5" stroke-width="1.6"><rect x="6" y="6" width="88" height="52"/><path d="M50 6v52"/><circle cx="50" cy="32" r="8"/><rect x="6" y="20" width="12" height="24"/><rect x="82" y="20" width="12" height="24"/></g>${c ? '<path d="M3 10Q50-8 97 10" fill="none" stroke="#c3d6cb" stroke-width="2"/>' : ""}</svg>`;

export { OUT, page, header, logo, icoCheck, icoX, icoWarn, icoBot, icoChat, miniPitch, navCustomer };

