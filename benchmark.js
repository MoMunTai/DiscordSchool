// จำลองภาระ opus encode/decode ของระบบ relay ที่สเกลต่างๆ
// วัดว่า "งานต่อ 20ms" ทำเสร็จในงบ 20ms ไหม (ถ้าเกิน = ตามเรียลไทม์ไม่ทัน → ดีเลย์บวม)
const { OpusEncoder } = require("@discordjs/opus");

const FRAME = 3840; // 20ms stereo 48k s16le
// PCM ที่มีสัญญาณจริง (worst case กว่าความเงียบ)
const pcm = Buffer.alloc(FRAME);
for (let i = 0; i < FRAME; i += 2) pcm.writeInt16LE(((Math.sin(i * 0.05) * 8000) | 0), i);
const opusPkt = new OpusEncoder(48000, 2).encode(pcm);

function run(label, nEnc, nDec, ticks = 500) {
  const encoders = Array.from({ length: nEnc }, () => new OpusEncoder(48000, 2));
  const decoders = Array.from({ length: nDec }, () => new OpusEncoder(48000, 2));
  const times = [];
  for (let t = 0; t < ticks; t++) {
    const t0 = process.hrtime.bigint();
    for (const e of encoders) e.encode(pcm);
    for (const d of decoders) d.decode(opusPkt);
    times.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  times.sort((a, b) => a - b);
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const p99 = times[Math.floor(times.length * 0.99)];
  const max = times[times.length - 1];
  const ok = p99 < 20;
  console.log(
    `${label.padEnd(28)} enc=${String(nEnc).padStart(2)} dec=${String(nDec).padStart(2)} | ` +
      `avg=${avg.toFixed(2)}ms p99=${p99.toFixed(2)}ms max=${max.toFixed(2)}ms | ` +
      `งบ20ms: ${ok ? "✅ ทัน" : "❌ ไม่ทัน"} (เหลือ ${(20 / p99).toFixed(1)}x)`
  );
}

console.log(`CPU: ${require("os").cpus()[0].model} (${require("os").cpus().length} cores)\n`);
// แต่ละแถว = สถานการณ์ภาระต่อ 20ms
run("2 ห้อง (ปัจจุบัน)", 3, 3);            // 2 speaker+talkback enc, leader+head dec
run("20 ห้อง: ไม่มีใครพูด", 21, 0);         // 20 speaker + 1 talkback encode silence ตลอด
run("20 ห้อง: 3 Leader พูดพร้อมกัน", 21, 3); // + decode 3 leader
run("20 ห้อง: + 6 Head talkback", 24, 9);   // worst: 3 leader + 6 head decode พร้อมกัน
run("เผื่อโต 40 ห้อง", 44, 12);
