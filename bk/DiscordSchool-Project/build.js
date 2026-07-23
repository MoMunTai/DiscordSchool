// ===========================================================================
//  build exe แบบ in-app — config ฝังในตัว, รันแล้วโชว์หน้าต่าง console สถานะ
//  ปิดด้วยกดปุ่ม X มุมขวาบน • รัน: npm run build
//  ออก: dist/DiscordSchool.exe (ไฟล์เดียวจบ)
// ===========================================================================
const { execSync } = require("node:child_process");
const fs = require("node:fs");

const OUT_DIR = "dist";
fs.mkdirSync(OUT_DIR, { recursive: true });

// ข้อความตอนแตกไฟล์ (พิมพ์โดย stub ก่อน node เริ่ม → ใช้อังกฤษกัน console เพี้ยน)
const MSG = "Preparing first run (extracting files), please wait...";

const CAXA =
  'node node_modules/caxa/build/index.mjs -D --input "." ' +
  `--output "${OUT_DIR}/DiscordSchool.exe" ` +
  '--exclude "dist" "*.zip" ' +
  `-m "${MSG}" ` +
  '-- "{{caxa}}/node_modules/.bin/node" "{{caxa}}/relay.js"';

// ฝัง flag ให้ relay ใช้ config ในตัวเสมอ (ไม่อ่านไฟล์ภายนอก)
fs.writeFileSync("locked.flag", "in-app");
try {
  execSync(CAXA, { stdio: "inherit" });
} finally {
  fs.rmSync("locked.flag", { force: true });
}

console.log(`\n✅ สร้าง ${OUT_DIR}/DiscordSchool.exe (ดับเบิลคลิกเปิด → โชว์หน้าต่าง console สถานะ, ปิดด้วยกด X)`);
