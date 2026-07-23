// ===========================================================================
//  build .exe — Guild War Broadcast (by KongPlayCh)
//  เปิด exe = เริ่ม Web Dashboard อัตโนมัติ + เปิด browser + เริ่มบอทให้เลย
//  config ฝังในตัว • ปิดด้วยกดปุ่ม X • รัน: npm run build
//  ออก: dist/GuildWarBroadcast.exe (ไฟล์เดียวจบ)
// ===========================================================================
const { execSync } = require("node:child_process");
const fs = require("node:fs");

const OUT_DIR = "dist";
const EXE = `${OUT_DIR}/GuildWarBroadcast.exe`;
fs.mkdirSync(OUT_DIR, { recursive: true });

// ข้อความตอนแตกไฟล์ครั้งแรก (พิมพ์โดย stub ก่อน node เริ่ม → ใช้อังกฤษกัน console เพี้ยน)
const MSG = "Guild War Broadcast - first run, extracting files, please wait...";

// entry = web/server.js → เปิดมาแล้ว start web + autostart บอท + เปิด browser
const CAXA =
  'node node_modules/caxa/build/index.mjs -D --input "." ' +
  `--output "${EXE}" ` +
  '--exclude "dist" "*.zip" ' +
  `-m "${MSG}" ` +
  '-- "{{caxa}}/node_modules/.bin/node" "{{caxa}}/web/server.js"';

// ฝัง flag → relay ใช้ config ในตัว + server รู้ว่าเป็น .exe (autostart/open browser)
fs.writeFileSync("locked.flag", "in-app");
try {
  execSync(CAXA, { stdio: "inherit" });
} finally {
  fs.rmSync("locked.flag", { force: true });
}

console.log(`\n✅ สร้าง ${EXE} แล้ว`);
console.log("   ดับเบิลคลิกเปิด → เริ่ม Web Dashboard + เปิด browser + บอทออนไลน์อัตโนมัติ (ปิดด้วยกด X)");
