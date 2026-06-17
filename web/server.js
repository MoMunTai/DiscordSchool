// ===========================================================================
//  Web Dashboard — คุมระบบ DiscordSchool ผ่าน browser
//  start/stop/restart + ปรับ volume + ดู log สด (WebSocket)
//  รัน: npm run web   →  เปิด http://localhost:3000
//  ตั้งรหัสผ่าน (ออปชัน): WEB_PASSWORD=xxxx  •  เปลี่ยนพอร์ต: PORT=8080
// ===========================================================================
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { WebSocketServer } = require("ws");

const ROOT = path.join(__dirname, "..");
const RELAY = path.join(ROOT, "relay.js");
const PORT = process.env.PORT || 3000;
const PASSWORD = process.env.WEB_PASSWORD || ""; // ว่าง = ไม่ต้องใส่รหัส

// อ่านรายชื่อห้องจาก config (ไว้ทำปุ่ม volume)
let roomNames = [];
try {
  require("dotenv").config({ path: path.join(ROOT, ".env") });
  roomNames = (require(path.join(ROOT, "config.js")).speakers || []).map((s) => s.name);
} catch (e) {
  console.error("⚠️  โหลด config.js ไม่ได้:", e.message);
}

let child = null;
let stats = { running: false, bots: 0, rooms: 0, ready: false };
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
  process.stdout.write(line + "\n"); // โชว์ใน console ของ server ด้วย
  broadcast({ type: "log", line });
}
function sendStatus() {
  stats.running = !!child;
  broadcast({ type: "status", stats });
}

function onData(d) {
  for (const line of d.toString().split(/\r?\n/)) {
    if (line === "") continue;
    if (line.includes("logged in")) stats.bots++;
    if (line.includes("พร้อมเล่นเสียง") || line.includes("กำลังฟังในห้อง")) stats.rooms++;
    if (line.includes("กำลังทำงาน")) stats.ready = true;
    pushLog(line);
  }
  sendStatus();
}
function start() {
  if (child) return;
  stats = { running: true, bots: 0, rooms: 0, ready: false };
  logs.length = 0;
  child = spawn(process.execPath, [RELAY], {
    cwd: ROOT,
    env: { ...process.env, DISCORDSCHOOL_DIR: ROOT },
  });
  child.stdout.on("data", onData);
  child.stderr.on("data", onData);
  child.on("exit", (code) => {
    pushLog(`[web] บอทหยุดทำงาน (code=${code})`);
    child = null;
    stats.ready = false;
    sendStatus();
  });
  pushLog("[web] กำลังเริ่มบอท...");
  sendStatus();
}
function stop() {
  if (child) {
    try {
      child.kill();
    } catch {}
    child = null;
  }
  pushLog("[web] สั่งหยุดบอท");
  sendStatus();
}
function cmd(line) {
  if (child && child.stdin.writable) child.stdin.write(line + "\n");
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
      return send(res, 200, { stats: { ...stats, running: !!child }, rooms: roomNames, needPw: !!PASSWORD });
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
wss.on("connection", (ws, req) => {
  const url = new URL(req.url, "http://x");
  if (PASSWORD && url.searchParams.get("pw") !== PASSWORD) return ws.close();
  clients.add(ws);
  ws.send(JSON.stringify({ type: "init", logs, stats: { ...stats, running: !!child }, rooms: roomNames }));
  ws.on("close", () => clients.delete(ws));
});

server.listen(PORT, () => {
  console.log("============================================================");
  console.log(`   🌐 Web Dashboard: http://localhost:${PORT}`);
  if (PASSWORD) console.log("   🔒 ต้องใส่รหัสผ่าน (WEB_PASSWORD)");
  console.log("   ปิด: กด Ctrl+C");
  console.log("============================================================");
});

process.on("SIGINT", () => {
  stop();
  process.exit(0);
});
