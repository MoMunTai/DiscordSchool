// ===========================================================================
//  build .exe — Guild War Broadcast (by KongPlayCh)
//  เปิด exe = เริ่ม Web Dashboard อัตโนมัติ + เปิด browser (เลือกห้องแล้วกด ▶ เริ่ม เอง)
//  config ฝังในตัว • ปิดด้วยกดปุ่ม X • รัน: npm run build
//  ออก: dist/GuildWarBroadcast.exe (ไฟล์เดียวจบ)
// ===========================================================================
const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const OUT_DIR = "dist";
fs.mkdirSync(OUT_DIR, { recursive: true });

// เลือก config ตอน build ได้ (สำหรับ build แยกคนละดิส):
//   npm run build                      → ใช้ config.js เดิม  → GuildWarBroadcast.exe
//   npm run build -- config.we.js      → ฝัง config.we.js    → GuildWarBroadcast-we.exe
const CONFIG_ARG = process.argv[2];
let exeSuffix = "";
if (CONFIG_ARG) {
  if (!fs.existsSync(CONFIG_ARG)) {
    console.error(`❌ ไม่พบไฟล์ config: ${CONFIG_ARG}`);
    process.exit(1);
  }
  // ตั้งชื่อ exe ตาม config เช่น config.we.js → -we
  exeSuffix = "-" + path.basename(CONFIG_ARG, ".js").replace(/^config\.?/, "");
}
const EXE = `${OUT_DIR}/GuildWarBroadcast${exeSuffix}.exe`;

// ข้อความตอนแตกไฟล์ครั้งแรก (พิมพ์โดย stub ก่อน node เริ่ม → ใช้อังกฤษกัน console เพี้ยน)
const MSG = "Guild War Broadcast - first run, extracting files, please wait...";

// ---------------------------------------------------------------------------
//  ไอคอน exe (ออปชัน): ถ้ามีไฟล์ icon.ico ในโปรเจกต์ → ใช้เป็นรูปไอคอนของ exe
//  ไม่มีไฟล์ = ข้าม ใช้ไอคอน default
//  (แนะนำ .ico แบบหลายขนาดในไฟล์เดียว: 16/32/48/256 px)
//  วิธีทำ: ฝังไอคอนลง "สำเนา stub" ของ caxa ก่อน build
//  (ต้องฝังที่ stub ก่อน — ห้ามแก้ exe ที่ build เสร็จแล้ว เพราะมี payload แนบท้าย จะพัง)
// ---------------------------------------------------------------------------
async function makeIconStub() {
  if (!fs.existsSync("icon.ico")) return null;
  console.log("🖼  พบ icon.ico → ใส่ไอคอนให้ exe...");
  const rcedit = require("rcedit");
  const stubIcon = `${OUT_DIR}/stub-icon.exe`; // อยู่ใน dist = ไม่ถูกฝังเข้า exe
  fs.copyFileSync("node_modules/caxa/stubs/stub--win32--x64", stubIcon);
  await rcedit(stubIcon, { icon: "icon.ico" });

  // ⭐ สำคัญ: ท้ายไฟล์ stub ต้องจบด้วย separator "\nCAXACAXACAXA\n" (caxa ใช้หา archive ที่แนบท้าย)
  //  rcedit เขียนไฟล์ PE ใหม่ทำให้ท่อนนี้หลุด → ต้องเติมกลับ ไม่งั้น exe เปิดแล้วดับทันที
  //  ("caxa stub: Failed to find archive")
  const SEP = "\n" + "CAXA".repeat(3) + "\n";
  if (!fs.readFileSync(stubIcon).includes(Buffer.from(SEP))) {
    fs.appendFileSync(stubIcon, SEP);
    console.log("🖼  เติม separator ท้าย stub กลับให้แล้ว");
  }
  console.log("🖼  ฝังไอคอนลง stub แล้ว");
  return stubIcon;
}

// entry = web/server.js → เปิดมาแล้ว start web + เปิด browser (บอทรอกด ▶ เริ่ม บนเว็บ)
const caxaCmd = (stubPath) =>
  'node node_modules/caxa/build/index.mjs -D --input "." ' +
  `--output "${EXE}" ` +
  '--exclude "dist" "*.zip" "rooms.json" "icon.ico" ' +
  `-m "${MSG}" ` +
  (stubPath ? `--stub "${stubPath}" ` : "") +
  '-- "{{caxa}}/node_modules/.bin/node" "{{caxa}}/web/server.js"';

(async () => {
  // ทำไอคอน (ถ้ามี icon.jpg) — พลาดก็แค่ใช้ไอคอน default ไม่ให้ build ล้ม
  let stubIcon = null;
  try {
    stubIcon = await makeIconStub();
  } catch (e) {
    console.warn("⚠️  ทำไอคอนไม่สำเร็จ ใช้ไอคอน default แทน:", e.message);
  }

  // ฝัง flag → relay ใช้ config ในตัว + server รู้ว่าเป็น .exe (autostart/open browser)
  fs.writeFileSync("locked.flag", "in-app");

  // ถ้าเลือก config อื่น → สลับมาทับ config.js ชั่วคราวระหว่าง build (backup ไว้ใน dist/ ซึ่งไม่ถูกฝัง)
  const CONFIG_BAK = `${OUT_DIR}/config.backup.js`;
  if (CONFIG_ARG) {
    fs.copyFileSync("config.js", CONFIG_BAK);
    fs.copyFileSync(CONFIG_ARG, "config.js");
    console.log(`⚙️  build ด้วย config: ${CONFIG_ARG}`);
  }
  try {
    execSync(caxaCmd(stubIcon), { stdio: "inherit" });
  } finally {
    fs.rmSync("locked.flag", { force: true });
    if (CONFIG_ARG) {
      fs.copyFileSync(CONFIG_BAK, "config.js"); // คืน config.js เดิม
      fs.rmSync(CONFIG_BAK, { force: true });
    }
    if (stubIcon) fs.rmSync(stubIcon, { force: true }); // เก็บกวาด stub ชั่วคราว
  }

  console.log(`\n✅ สร้าง ${EXE} แล้ว`);
  console.log("   ดับเบิลคลิกเปิด → เริ่ม Web Dashboard + เปิด browser → เลือกห้องแล้วกด ▶ เริ่ม (ปิดด้วยกด X)");
})();
