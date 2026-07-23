// ===========================================================================
//  Guild War Broadcast — Web Dashboard (by KongPlayCh)
//  คุมระบบผ่าน browser: start/stop/restart + ปรับ volume + ดู log สด + ไฟ ON AIR
//  รัน: npm run web   →  เปิด http://localhost:4000
//  ตั้งรหัสผ่าน (ออปชัน): WEB_PASSWORD=xxxx  •  เปลี่ยนพอร์ต: PORT=8080
// ===========================================================================
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { StringDecoder } = require("node:string_decoder");
const { WebSocketServer } = require("ws");

const ROOT = path.join(__dirname, "..");
const RELAY = path.join(ROOT, "relay.js");

// ⭐ โหลด .env ก่อน — ต้องมาก่อนอ่าน process.env ทุกตัว (PORT/WEB_PASSWORD/AUTO_*)
// ไม่งั้นค่าใน .env ยังไม่เข้า process.env ตอนคำนวณ → ใช้ค่า default เสมอ
require("dotenv").config({ path: path.join(ROOT, ".env") });

// port เริ่มต้น 43210 (เลขไม่ค่อยมีใครใช้ ลดโอกาสชน) — ถ้าไม่ว่างจะขยับหาที่ว่างเองอัตโนมัติ
// ตั้งเองได้ด้วย env: PORT=8080 (ก็ยัง fallback ให้ถ้าชน)
const BASE_PORT = Number(process.env.PORT) || 43210;
const PASSWORD = process.env.WEB_PASSWORD || ""; // ว่าง = ไม่ต้องใส่รหัส

// PACKAGED = ถูก build เป็น .exe (มี locked.flag ฝังมา) → เปิด browser ให้อัตโนมัติ
// บอท "ไม่" ออนไลน์เอง — ให้ผู้ใช้เลือกห้องบนหน้าเว็บก่อน แล้วกด ▶ เริ่ม เอง
// (โหมด dev บังคับ autostart ได้ด้วย AUTO_START=1)
const PACKAGED = fs.existsSync(path.join(ROOT, "locked.flag"));
const AUTO_START = process.env.AUTO_START === "1";
const AUTO_OPEN = PACKAGED || process.env.AUTO_OPEN === "1";

// อ่านการตั้งค่าจาก config (ไว้ทำปุ่ม volume + toggle เปิด/ปิดห้อง + นับ total)
// roomList = [{name, label}] — name คือคีย์ภายใน (ชื่อบอท), label คือชื่อห้องที่โชว์ให้ผู้ใช้
let roomList = [];
let roomNames = [];
let speakerHasToken = {};
let hasTalkback = false;
try {
  const cfg = require(path.join(ROOT, "config.js"));
  roomList = (cfg.speakers || []).map((s) => ({ name: s.name, label: s.label || s.name.replace(/Bot$/, "") }));
  roomNames = roomList.map((r) => r.name);
  for (const s of cfg.speakers || []) speakerHasToken[s.name] = !!s.token;
  hasTalkback = !!(cfg.talkbackBot && cfg.talkbackBot.token);
} catch (e) {
  console.error("⚠️  โหลด config.js ไม่ได้:", e.message);
}

// ห้องที่เปิดใช้ — เลือกบนหน้าเว็บก่อนกดเริ่ม, จำค่าไว้ในไฟล์ rooms.json (มีผลตอนเริ่ม/รีสตาร์ทบอท)
const ROOMS_FILE = path.join(ROOT, "rooms.json");
let enabledRooms = new Set(roomNames); // ค่าเริ่มต้น = เปิดทุกห้อง
try {
  const saved = JSON.parse(fs.readFileSync(ROOMS_FILE, "utf8"));
  if (Array.isArray(saved)) enabledRooms = new Set(saved.filter((n) => roomNames.includes(n)));
} catch {} // ไม่มีไฟล์ = ใช้ค่าเริ่มต้น
function saveRooms() {
  try {
    fs.writeFileSync(ROOMS_FILE, JSON.stringify([...enabledRooms]));
  } catch (e) {
    console.error("⚠️  บันทึก rooms.json ไม่ได้:", e.message);
  }
}

let child = null;
const totalBots = () => 1 + (hasTalkback ? 1 : 0) + [...enabledRooms].filter((n) => speakerHasToken[n]).length;
const baseStats = () => ({ running: false, bots: 0, rooms: 0, ready: false, air: false, totalBots: totalBots(), totalRooms: enabledRooms.size });
let stats = baseStats();
const logs = [];
const MAX_LOGS = 600;
const clients = new Set();

function broadcast(obj) {
  const m = JSON.stringify(obj);
  for (const ws of clients) {
    try {
      ws.send(m);
    } catch {}
  }
}
function pushLog(line) {
  logs.push(line);
  if (logs.length > MAX_LOGS) logs.shift();
  process.stdout.write(line + "\n");
  broadcast({ type: "log", line });
}
function sendStatus() {
  stats.running = !!child;
  broadcast({ type: "status", stats });
}

// แยก "เหตุการณ์สถานะ" (บรรทัดขึ้นต้นด้วย GWB {...}) ออกจาก log ปกติ
function handleEvent(json) {
  let e;
  try {
    e = JSON.parse(json);
  } catch {
    return;
  }
  switch (e.evt) {
    case "boot":
      stats.bots = 0;
      stats.rooms = 0;
      stats.ready = false;
      stats.air = false;
      if (e.totalBots) stats.totalBots = e.totalBots;
      if (e.totalRooms) stats.totalRooms = e.totalRooms;
      break;
    case "bot":
      stats.bots++;
      break;
    case "room":
      stats.rooms++;
      break;
    case "ready":
      stats.ready = true;
      break;
    case "air":
      stats.air = !!e.on;
      break;
    case "fatal":
      stats.ready = false;
      break;
    default:
      return; // vol/volall/talkback — ไม่กระทบตัวเลขหลัก
  }
  sendStatus();
}

// อ่าน stdout/stderr ของ relay แบบ "ต่อบรรทัดให้ครบก่อน" —
// สำคัญมาก 2 จุด:
//  1) chunk อาจตัดกลางบรรทัด → ต้อง buffer จน \n ก่อนค่อย parse (ไม่งั้น JSON.parse GWB พัง)
//  2) chunk อาจตัดกลาง "ตัวอักษรไทย" (multibyte UTF-8) → ต้องใช้ StringDecoder
//     ถ้าใช้ d.toString() ตรงๆ ไบต์ที่ขาดจะกลายเป็นอักขระเพี้ยนไปเกาะหน้าบรรทัด GWB
//     ทำให้ startsWith("GWB ") พลาด → event หาย → ตัวเลขไม่ขึ้น
function makeLineReader() {
  const decoder = new StringDecoder("utf8");
  let buf = "";
  return (d) => {
    buf += decoder.write(d);
    let nl;
    while ((nl = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, nl).replace(/\r$/, "");
      buf = buf.slice(nl + 1);
      if (line === "") continue;
      // GWB อาจมีอักขระควบคุม (เช่น ) นำหน้าจาก stream framing ของ pipe → หา marker ในช่วงต้นบรรทัด
      const g = line.indexOf("GWB ");
      if (g >= 0 && g <= 2) handleEvent(line.slice(g + 4)); // ไม่โชว์บรรทัดโปรโตคอลใน log
      else pushLog(line);
    }
    if (buf.length > 65536) { pushLog(buf); buf = ""; } // กัน buffer โตถ้าไม่มี newline (ไม่ควรเกิด)
  };
}

function start() {
  if (child) return;
  if (!enabledRooms.size) {
    pushLog("[เว็บ] ⛔ ยังไม่ได้เลือกห้อง — เปิดอย่างน้อย 1 ห้องก่อนกดเริ่ม");
    sendStatus();
    return;
  }
  stats = baseStats();
  stats.running = true;
  logs.length = 0;
  child = spawn(process.execPath, [RELAY], {
    cwd: ROOT,
    env: { ...process.env, GWB_DIR: ROOT, GWB_ROOMS: [...enabledRooms].join(",") },
  });
  child.stdout.on("data", makeLineReader());
  child.stderr.on("data", makeLineReader());
  child.on("exit", (code) => {
    pushLog(`[เว็บ] บอทหยุดทำงาน (code=${code})`);
    child = null;
    stats.ready = false;
    stats.air = false;
    sendStatus();
  });
  pushLog("[เว็บ] กำลังเริ่มบอท...");
  sendStatus();
}
function stop() {
  if (child) {
    try {
      child.kill();
    } catch {}
    child = null;
  }
  pushLog("[เว็บ] สั่งหยุดบอท");
  sendStatus();
}
function cmd(line) {
  if (child && child.stdin.writable) child.stdin.write(line + "\n");
}

// เปิด browser ไปที่ dashboard (ตอนเป็น .exe)
function openBrowser(url) {
  try {
    if (process.platform === "win32") spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" }).unref();
    else if (process.platform === "darwin") spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
    else spawn("xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
  } catch {}
}

// ---------------------------------------------------------------------------
function checkAuth(req) {
  if (!PASSWORD) return true;
  const pw = req.headers["x-password"] || new URL(req.url, "http://x").searchParams.get("pw");
  return pw === PASSWORD;
}
function send(res, code, body, type = "application/json") {
  res.writeHead(code, { "Content-Type": type });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");

  if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
    return send(res, 200, fs.readFileSync(path.join(__dirname, "public", "index.html")), "text/html; charset=utf-8");
  }

  if (url.pathname.startsWith("/api/")) {
    if (!checkAuth(req)) return send(res, 401, { error: "unauthorized" });

    if (url.pathname === "/api/status")
      return send(res, 200, { stats: { ...stats, running: !!child }, rooms: roomList, enabled: [...enabledRooms], needPw: !!PASSWORD });
    // เลือกห้องที่เปิดใช้ (มีผลตอนเริ่ม/รีสตาร์ทบอทครั้งถัดไป)
    if (req.method === "POST" && url.pathname === "/api/rooms") {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        try {
          const { enabled } = JSON.parse(body || "{}");
          if (!Array.isArray(enabled)) return send(res, 400, { error: "bad request" });
          enabledRooms = new Set(enabled.filter((n) => roomNames.includes(n)));
          saveRooms();
          if (!child) {
            // ยังไม่รัน → อัปเดตตัวเลข total ทันที (ตอนรันอยู่ ตัวเลขมาจาก boot event ของ relay)
            stats.totalBots = totalBots();
            stats.totalRooms = enabledRooms.size;
          }
          broadcast({ type: "rooms", enabled: [...enabledRooms] });
          sendStatus();
          send(res, 200, { ok: true, enabled: [...enabledRooms] });
        } catch {
          send(res, 400, { error: "bad request" });
        }
      });
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/start") {
      start();
      return send(res, 200, { ok: true });
    }
    if (req.method === "POST" && url.pathname === "/api/stop") {
      stop();
      return send(res, 200, { ok: true });
    }
    if (req.method === "POST" && url.pathname === "/api/restart") {
      stop();
      setTimeout(start, 1500);
      return send(res, 200, { ok: true });
    }
    if (req.method === "POST" && url.pathname === "/api/volume") {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        try {
          const { room, value, all } = JSON.parse(body || "{}");
          if (all !== undefined) cmd(`setvolall ${all}`);
          else if (room) cmd(`setvol ${room} ${value}`);
          send(res, 200, { ok: true });
        } catch {
          send(res, 400, { error: "bad request" });
        }
      });
      return;
    }
    return send(res, 404, { error: "not found" });
  }

  send(res, 404, "Not found", "text/plain");
});

const wss = new WebSocketServer({ server });
// WebSocketServer จะรับ error ของ http server มา re-emit — ต้องดักไว้ ไม่งั้น EADDRINUSE
// จะ throw ที่นี่ก่อนตัว fallback หา port ใหม่ (server.on("error") ข้างล่าง) ได้ทำงาน
wss.on("error", () => {});
wss.on("connection", (ws, req) => {
  const url = new URL(req.url, "http://x");
  if (PASSWORD && url.searchParams.get("pw") !== PASSWORD) return ws.close();
  clients.add(ws);
  ws.send(JSON.stringify({ type: "init", logs, stats: { ...stats, running: !!child }, rooms: roomList, enabled: [...enabledRooms] }));
  ws.on("close", () => clients.delete(ws));
});

// ---------------------------------------------------------------------------
//  เปิด server แบบหา port อัตโนมัติ: เริ่มที่ BASE_PORT ถ้าไม่ว่างขยับทีละ 1 (สูงสุด 20 ครั้ง)
//  ผู้ใช้ไม่ต้องตั้งค่าอะไร — browser จะถูกเปิดไปที่ port ที่ได้จริงเสมอ
// ---------------------------------------------------------------------------
let tryPort = BASE_PORT;
let portTries = 0;

server.on("error", (e) => {
  if (e.code === "EADDRINUSE" && portTries < 20) {
    portTries++;
    console.log(`⚠️  port ${tryPort} ไม่ว่าง → ลอง ${tryPort + 1}`);
    tryPort++;
    setTimeout(() => server.listen(tryPort), 100);
  } else {
    console.error("⛔ เปิด web server ไม่ได้:", e.message);
    process.exit(1);
  }
});

server.listen(tryPort, () => {
  const port = server.address().port;
  const url = `http://localhost:${port}`;
  process.stdout.write(
    "\n============================================================\n" +
      "   🎙  Guild War Broadcast — Control Panel (by KongPlayCh)\n" +
      `   🌐  ${url}\n` +
      (port !== BASE_PORT ? `   ⚠️  port ${BASE_PORT} ไม่ว่าง เลยใช้ ${port} แทน\n` : "") +
      (PASSWORD ? "   🔒  ต้องใส่รหัสผ่าน (WEB_PASSWORD)\n" : "") +
      "   ❌  ปิดโปรแกรม: กดปุ่ม X มุมขวาบน (หรือ Ctrl+C)\n" +
      "============================================================\n"
  );
  if (AUTO_START) {
    pushLog("[เว็บ] เปิดโปรแกรม → เริ่มบอทอัตโนมัติ");
    start();
  }
  if (AUTO_OPEN) openBrowser(url);
});

// ปิด server → หยุดบอทด้วยเสมอ (กันบอทค้างเป็น orphan)
function shutdown() {
  stop();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
process.on("exit", () => {
  if (child) {
    try {
      child.kill();
    } catch {}
  }
});
