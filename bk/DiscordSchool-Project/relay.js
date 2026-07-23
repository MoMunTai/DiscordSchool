const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");

// ตั้ง console เป็น UTF-8 บน Windows เพื่อให้ภาษาไทยไม่เพี้ยน
if (process.platform === "win32") {
  try {
    require("node:child_process").execSync("chcp 65001", { stdio: "ignore" });
  } catch {}
}

console.log("============================================================");
console.log("   📡  Discord School Broadcast");
console.log("============================================================");

// --- กันเปิดซ้ำ (single instance) — ป้องกัน token ชนจากการรันหลายตัว ---
const LOCK_FILE = path.join(os.tmpdir(), "discordschool.lock");
function pidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === "EPERM";
  }
}
try {
  if (fs.existsSync(LOCK_FILE)) {
    const oldPid = parseInt(fs.readFileSync(LOCK_FILE, "utf8").trim(), 10);
    if (oldPid && oldPid !== process.pid && pidAlive(oldPid)) {
      console.log("\n⚠️  โปรแกรมเปิดอยู่แล้ว (อีกหน้าต่างหนึ่ง) — ไม่เปิดซ้ำ");
      console.log("   ปิดหน้าต่างนี้ได้เลย\n");
      setTimeout(() => process.exit(0), 6000); // ค้างไว้ให้อ่านก่อนปิด
      return;
    }
  }
  fs.writeFileSync(LOCK_FILE, String(process.pid));
} catch {}

// โหมดล็อก: ถ้ามีไฟล์ locked.flag (ใส่ตอน build แบบล็อก) = ใช้แต่ config ที่ฝังในตัว ไม่อ่านภายนอก
const LOCKED = fs.existsSync(path.join(__dirname, "locked.flag"));
// โฟลเดอร์สำหรับหา config.js / .env "ภายนอก" (ข้างๆ exe) — แก้ได้โดยไม่ต้อง build ใหม่
const APP_DIR = LOCKED ? __dirname : process.env.DISCORDSCHOOL_DIR || process.cwd();
if (LOCKED) console.log("🔒 โหมดล็อก: ใช้ config ที่ฝังในตัว (แก้ไม่ได้)");

// โหลด .env: ตัวที่ฝังในตัว (fallback) ก่อน แล้วให้ตัวภายนอก override (ถ้าไม่ล็อก)
require("dotenv").config({ path: path.join(__dirname, ".env") });
if (!LOCKED) require("dotenv").config({ path: path.join(APP_DIR, ".env"), override: true });

process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

const { Client, GatewayIntentBits, MessageFlags } = require("discord.js");
const {
  joinVoiceChannel,
  entersState,
  VoiceConnectionStatus,
  EndBehaviorType,
  createAudioPlayer,
  createAudioResource,
  StreamType,
  NoSubscriberBehavior,
} = require("@discordjs/voice");
const prism = require("prism-media");
const { Readable } = require("node:stream");
const { EventEmitter } = require("node:events");

// โหลด config: ใช้ตัวภายนอก (ข้างๆ exe) ถ้ามี ไม่งั้นใช้ตัวที่ฝังในตัว
const extConfig = path.join(APP_DIR, "config.js");
let config;
try {
  config = fs.existsSync(extConfig) && path.resolve(extConfig) !== path.resolve(__dirname, "config.js")
    ? require(extConfig)
    : require("./config");
  if (path.resolve(extConfig) !== path.resolve(__dirname, "config.js") && fs.existsSync(extConfig)) {
    console.log(`⚙️  ใช้ config ภายนอก: ${extConfig}`);
  }
} catch (e) {
  console.error("อ่าน config ภายนอกไม่ได้ ใช้ตัวในตัวแทน:", e.message);
  config = require("./config");
}

// ---------------------------------------------------------------------------
//  Audio bus กลาง: ส่งเสียงในรูปแบบ PCM (48kHz, stereo, signed 16-bit LE)
//  LeaderBot เป็นคน emit, ทุก SpeakerBot เป็นคนฟัง
// ---------------------------------------------------------------------------
const bus = new EventEmitter();
bus.setMaxListeners(0); // มี speaker ได้ไม่จำกัด

// ---------------------------------------------------------------------------
//  Talkback bus: เสียงหัวหน้า/รอง จากห้องเรียน → ส่งกลับเล่นในห้อง Leader Room
// ---------------------------------------------------------------------------
const talkbackBus = new EventEmitter();
talkbackBus.setMaxListeners(0);
// ระดับเสียง talkback รายห้อง: ชื่อห้อง -> gain (1.0=100%, 0=ปิด, สูงสุด 2.0=200%)
const roomVolume = new Map();
const VOL_MAX = 2.0;

// user ID ของบอทเราทุกตัว — กันการ relay เสียงบอทกันเอง (เช่น LeaderBot ได้ยิน TalkbackBot)
const botIds = new Set();

const PCM = { rate: 48000, channels: 2, frameSize: 960 };

// 1 เฟรม PCM 20ms @ 48kHz stereo s16le = 960 samples * 2 ch * 2 bytes = 3840 bytes
const FRAME_BYTES = 3840;
const SILENCE_FRAME = Buffer.alloc(FRAME_BYTES);
// จำกัดความลึกคิวเสียง (กัน latency สะสม) — 5 เฟรม ≈ 100ms (ต่ำ = ดีเลย์น้อยแต่อาจสะดุดถ้าเน็ตกระตุก)
const MAX_QUEUE_FRAMES = 5;

// สตรีม PCM ต่อเนื่องต่อ 1 speaker:
//  - มีเสียงจริงในคิว → ส่งเสียงจริง
//  - ไม่มี → ส่งความเงียบ
// ทำให้ stream "ไม่มีวันจบ" → AudioPlayer อยู่สถานะ playing ตลอด ไม่หล่นเป็น idle
class ContinuousPCM extends Readable {
  constructor() {
    super({ highWaterMark: FRAME_BYTES }); // buffer ภายในต่ำสุด → latency ต่ำ
    this.queue = [];
  }
  feed(chunk) {
    this.queue.push(chunk);
    // กัน latency สะสม: ถ้าคิวลึกเกิน ทิ้งเฟรมเก่าทิ้ง ตามเสียงสดให้ทัน
    while (this.queue.length > MAX_QUEUE_FRAMES) this.queue.shift();
  }
  _read() {
    this.push(this.queue.shift() || SILENCE_FRAME);
  }
}

// ปรับความดังของ PCM (s16le) ตาม gain — คูณทุก sample แล้ว clamp ไม่ให้ overflow
function applyGain(buf, gain) {
  if (gain === 1) return buf;
  const out = Buffer.allocUnsafe(buf.length);
  for (let i = 0; i + 1 < buf.length; i += 2) {
    let s = Math.round(buf.readInt16LE(i) * gain);
    if (s > 32767) s = 32767;
    else if (s < -32768) s = -32768;
    out.writeInt16LE(s, i);
  }
  return out;
}

// ตรวจว่า user คนนี้ได้รับอนุญาตให้ "พูดกลับหา Leader" ไหม
//  ผ่านถ้า: มี role ใน config.talkerRoleIds  หรือ  userId อยู่ใน cfg.talkers
//  ถ้าไม่ได้กำหนดทั้งสองอย่าง = อนุญาตทุกคนในห้อง
async function isAllowedTalker(guild, userId, cfg) {
  const roleIds = config.talkerRoleIds || [];
  const userIds = cfg.talkers || [];
  if (roleIds.length === 0 && userIds.length === 0) return true;
  if (userIds.includes(userId)) return true;
  if (roleIds.length) {
    let member = guild.members.cache.get(userId);
    if (!member) member = await guild.members.fetch(userId).catch(() => null);
    if (member && roleIds.some((id) => member.roles.cache.has(id))) return true;
  }
  return false;
}

// helper: เข้าห้องเสียงแล้วรอจน Ready (พร้อม log สถานะ + auto-reconnect)
async function connectToChannel(client, channelId, { selfDeaf, selfMute, label }) {
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel) {
    throw new Error(
      `[${label}] ไม่พบห้อง channelId=${channelId} — เช็คว่า Channel ID ถูกต้อง และบอทถูกเชิญเข้าเซิร์ฟเวอร์แล้ว`
    );
  }
  if (!channel.isVoiceBased?.()) {
    throw new Error(`[${label}] channelId=${channelId} ไม่ใช่ห้องเสียง (เป็น ${channel.type})`);
  }

  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: channel.guild.id,
    adapterCreator: channel.guild.voiceAdapterCreator,
    selfDeaf,
    selfMute,
    // ⭐ สำคัญ: บอทหลายตัวใน guild เดียวกันต้องมี group ไม่ซ้ำกัน
    // ไม่งั้น @discordjs/voice จะถือว่าเป็น connection เดียวกัน (index ด้วย guildId)
    // แล้วตัวหลังเขียนทับตัวหน้า → บอทเด้งไปห้องสุดท้ายตัวเดียว
    group: label,
  });

  connection.on("stateChange", (oldS, newS) => {
    if (oldS.status !== newS.status) {
      console.log(`[${label}] voice: ${oldS.status} -> ${newS.status}`);
    }
  });
  connection.on("error", (err) => console.error(`[${label}] VOICE ERROR:`, err.message));

  // ถ้าหลุด ลองต่อใหม่อัตโนมัติ
  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    console.warn(`[${label}] หลุดการเชื่อมต่อ — กำลังลองต่อใหม่...`);
    try {
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
        entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
      ]);
    } catch {
      console.error(`[${label}] ต่อใหม่ไม่สำเร็จ — destroy connection`);
      connection.destroy();
    }
  });

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
  } catch {
    connection.destroy();
    throw new Error(
      `[${label}] เข้าห้อง "${channel.name}" ไม่สำเร็จใน 30 วิ — เช็คสิทธิ์ Connect/Speak ของบอทในห้องนี้`
    );
  }
  return { connection, channel };
}

// ===========================================================================
//  Slash command ปรับ volume talkback รายห้อง: /setvoltb, /voltb
// ===========================================================================
async function setupVolumeCommands(client, guild) {
  // ลงทะเบียนคำสั่งแบบ guild (ใช้ได้ทันที)
  const commandData = [
    {
      name: "setvoltb",
      description: "ตั้งระดับเสียง Talkback ของห้อง (1.0=100%, 1.3=130%, 0=ปิด)",
      options: [
        {
          name: "room",
          description: "ห้อง",
          type: 3, // STRING
          required: true,
          choices: config.speakers.slice(0, 25).map((s) => ({ name: s.name, value: s.name })),
        },
        {
          name: "value",
          description: "ค่าความดัง 0–2 (เช่น 1.0=100%, 1.3=130%, 0=ปิด)",
          type: 10, // NUMBER
          required: true,
          min_value: 0,
          max_value: VOL_MAX,
        },
      ],
    },
    {
      name: "setvolall",
      description: "ตั้งระดับเสียง Talkback ของทุกห้องพร้อมกัน (1.0=100%, 1.3=130%, 0=ปิด)",
      options: [
        {
          name: "value",
          description: "ค่าความดัง 0–2 (เช่น 1.0=100%, 1.5=150%, 0=ปิดทุกห้อง)",
          type: 10, // NUMBER
          required: true,
          min_value: 0,
          max_value: VOL_MAX,
        },
      ],
    },
    {
      name: "voltb",
      description: "ดูระดับเสียง Talkback ของทุกห้อง",
    },
  ];

  try {
    await guild.commands.set(commandData);
    console.log("🎚  ลงทะเบียนคำสั่ง /setvoltb, /setvolall, /voltb แล้ว");
  } catch (e) {
    console.error("⛔ ลงทะเบียน slash command ไม่สำเร็จ:", e.message);
    console.error("   👉 เชิญ LeaderBot ใหม่ให้มี scope 'applications.commands' (ดูคู่มือ)");
  }

  client.on("interactionCreate", async (i) => {
    if (!i.isChatInputCommand()) return;

    if (i.commandName === "setvoltb") {
      const room = i.options.getString("room");
      let value = i.options.getNumber("value");
      if (!config.speakers.find((s) => s.name === room)) {
        return i.reply({ content: `❌ ไม่พบห้อง ${room}`, flags: MessageFlags.Ephemeral });
      }
      value = Math.max(0, Math.min(VOL_MAX, value));
      roomVolume.set(room, value);
      const pct = Math.round(value * 100);
      console.log(`🔊 ตั้ง volume talkback: ${room} = ${pct}% (โดย ${i.user.tag})`);
      return i.reply({
        content: `✅ ${room} → **${pct}%**${value === 0 ? " (ปิดเสียงห้องนี้)" : ""}`,
        flags: MessageFlags.Ephemeral,
      });
    }

    if (i.commandName === "setvolall") {
      let value = i.options.getNumber("value");
      value = Math.max(0, Math.min(VOL_MAX, value));
      for (const s of config.speakers) roomVolume.set(s.name, value);
      const pct = Math.round(value * 100);
      console.log(`🔊 ตั้ง volume ทุกห้อง = ${pct}% (โดย ${i.user.tag})`);
      return i.reply({
        content: `✅ ตั้งทุกห้อง (${config.speakers.length} ห้อง) → **${pct}%**${value === 0 ? " (ปิดทั้งหมด)" : ""}`,
        flags: MessageFlags.Ephemeral,
      });
    }

    if (i.commandName === "voltb") {
      const lines = config.speakers.map((s) => {
        const pct = Math.round((roomVolume.get(s.name) ?? 1) * 100);
        return `• ${s.name}: **${pct}%**${pct === 0 ? " (ปิด)" : ""}`;
      });
      return i.reply({
        content: "**ระดับเสียง Talkback ปัจจุบัน**\n" + lines.join("\n"),
        flags: MessageFlags.Ephemeral,
      });
    }
  });
}

// ===========================================================================
//  LEADER: ฟังเสียงในห้อง Leader Room แล้ว relay เป็น PCM ขึ้น bus
// ===========================================================================
async function startLeader() {
  const cfg = config.leader;
  if (!cfg.token) throw new Error("ไม่พบ token ของ LeaderBot (ตั้ง LEADER_TOKEN ใน .env)");

  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
  });

  client.once("clientReady", async () => {
    console.log(`👂 ${cfg.name} logged in as ${client.user.tag}`);
    botIds.add(client.user.id);
    // selfDeaf=false เพื่อ "รับ" เสียงอาจารย์ใหญ่ / selfMute=true เพราะ LeaderBot แค่ฟัง (talkback เล่นที่ TalkbackBot)
    const { connection, channel } = await connectToChannel(client, cfg.channelId, {
      selfDeaf: false,
      selfMute: true,
      label: cfg.name,
    });
    console.log(`👂 ${cfg.name} กำลังฟังในห้อง: ${channel.name}`);

    // --- ลงทะเบียน slash command ปรับ volume talkback (/setvoltb, /voltb) ---
    await setupVolumeCommands(client, channel.guild);

    const receiver = connection.receiver;
    const active = new Set(); // กันการ subscribe ซ้ำต่อ user

    receiver.speaking.on("start", (userId) => {
      if (botIds.has(userId)) return; // ข้ามเสียงบอทเรา (กัน LeaderBot ได้ยิน TalkbackBot)
      if (active.has(userId)) return;
      active.add(userId);
      console.log(`🎙  ตรวจพบเสียงพูดจาก userId=${userId} → กำลัง relay`);

      const opusStream = receiver.subscribe(userId, {
        end: { behavior: EndBehaviorType.AfterSilence, duration: 300 },
      });
      const decoder = new prism.opus.Decoder(PCM);

      opusStream.pipe(decoder);
      let frames = 0;
      decoder.on("data", (pcmChunk) => {
        if (frames === 0) console.log(`   ↳ 🎚  Leader decode PCM สำเร็จ (เริ่มส่งขึ้น bus)`);
        frames++;
        bus.emit("pcm", pcmChunk);
      });
      opusStream.on("data", () => {}); // ensure flowing

      const cleanup = () => {
        active.delete(userId);
        decoder.destroy();
      };
      opusStream.on("end", cleanup);
      opusStream.on("error", cleanup);
      decoder.on("error", cleanup);
    });
  });

  await client.login(cfg.token);
}

// ===========================================================================
//  SPEAKER: เล่นเสียงจาก bus ในห้องเรียนของตัวเอง
// ===========================================================================
async function startSpeaker(cfg) {
  if (!cfg.token) {
    console.warn(`⚠️  ข้าม ${cfg.name}: ไม่พบ token (ตั้ง ${cfg.name.toUpperCase()} token ใน .env)`);
    return;
  }

  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
  });

  client.once("clientReady", async () => {
    console.log(`🔊 ${cfg.name} logged in as ${client.user.tag}`);
    botIds.add(client.user.id);
    // selfDeaf=false เพื่อ "รับ" เสียงหัวหน้า/รอง (talkback) / selfMute=false เพื่อเล่น broadcast
    const { connection, channel } = await connectToChannel(client, cfg.channelId, {
      selfDeaf: false,
      selfMute: false,
      label: cfg.name,
    });
    console.log(`🔊 ${cfg.name} พร้อมเล่นเสียงในห้อง: ${channel.name}`);

    const player = createAudioPlayer({
      behaviors: { noSubscriber: NoSubscriberBehavior.Play },
    });
    player.on("error", (err) => console.error(`${cfg.name} PLAYER ERROR:`, err));
    player.on("stateChange", (o, n) => {
      if (o.status !== n.status) console.log(`   [${cfg.name}] player: ${o.status} -> ${n.status}`);
    });

    // สตรีม PCM ต่อเนื่อง (เงียบเมื่อไม่มีเสียง) — player อยู่ playing ตลอด ไม่หล่น idle
    const pcmStream = new ContinuousPCM();
    const resource = createAudioResource(pcmStream, { inputType: StreamType.Raw });
    player.play(resource);
    connection.subscribe(player);

    // ทุก chunk ที่ Leader ส่งมา → ป้อนเข้าคิวของห้องนี้
    let lastBeat = 0;
    bus.on("pcm", (chunk) => {
      pcmStream.feed(chunk);
      // log แบบ throttle ทุก ~2 วิ ให้เห็นว่าเสียงไหลเข้าห้องนี้จริง
      const now = process.hrtime.bigint();
      if (now - BigInt(lastBeat) > 2_000_000_000n) {
        lastBeat = Number(now);
        console.log(`   ↳ 🔊 ${cfg.name} กำลังเล่นเสียง relay...`);
      }
    });

    // --- TALKBACK: รับเสียงหัวหน้า/รอง (ตาม role) แล้วส่งกลับขึ้น talkbackBus ---
    const receiver = connection.receiver;
    const guild = channel.guild;
    const talking = new Set();
    const pending = new Set(); // กัน race ระหว่างรอเช็ค role
    receiver.speaking.on("start", async (userId) => {
      if (botIds.has(userId)) return; // ข้ามเสียงบอทเรา (กันลูป)
      if ((roomVolume.get(cfg.name) ?? 1) <= 0) return; // ห้องนี้ถูกตั้ง volume = 0 (ปิด)
      if (talking.has(userId) || pending.has(userId)) return;

      pending.add(userId);
      const allowed = await isAllowedTalker(guild, userId, cfg);
      pending.delete(userId);
      if (!allowed) return; // ไม่ใช่หัวหน้า/รอง → ไม่ส่ง
      if (talking.has(userId)) return;
      talking.add(userId);
      console.log(`   ⬆️  ${cfg.name}: รับเสียงหัวหน้า/รอง (userId=${userId}) → ส่งกลับ Leader`);

      const opusStream = receiver.subscribe(userId, {
        end: { behavior: EndBehaviorType.AfterSilence, duration: 300 },
      });
      const decoder = new prism.opus.Decoder(PCM);
      opusStream.pipe(decoder);
      decoder.on("data", (pcm) => {
        const g = roomVolume.get(cfg.name) ?? 1;
        if (g > 0) talkbackBus.emit("pcm", applyGain(pcm, g)); // ปรับความดังตาม volume ห้อง
      });

      const cleanup = () => {
        talking.delete(userId);
        decoder.destroy();
      };
      opusStream.on("end", cleanup);
      opusStream.on("error", cleanup);
      decoder.on("error", cleanup);
    });
  });

  await client.login(cfg.token);
}

// ===========================================================================
//  TALKBACK BOT: อยู่ในห้อง Leader Room เล่นเสียง talkback จากทุกห้องตลอดเวลา
//  (Leader คุมการได้ยินเองด้วยการ mute/unmute บอทตัวนี้ในแอป)
// ===========================================================================
async function startTalkbackBot() {
  const cfg = config.talkbackBot;
  if (!cfg || !cfg.token) {
    console.warn("⚠️  ข้าม TalkbackBot: ยังไม่ได้ตั้ง TALKBACK_TOKEN ใน .env (talkback ฉุกเฉินจะไม่ทำงาน)");
    return;
  }

  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
  });

  client.once("clientReady", async () => {
    console.log(`📻 ${cfg.name} logged in as ${client.user.tag}`);
    botIds.add(client.user.id);
    try {
      // selfDeaf=true (แค่เล่น ไม่ต้องรับ) / selfMute=false (ต้องส่งเสียง talkback ออก)
      const { connection, channel } = await connectToChannel(client, cfg.channelId, {
        selfDeaf: true,
        selfMute: false,
        label: cfg.name,
      });
      console.log(`📻 ${cfg.name} พร้อมในห้อง: ${channel.name} (Leader mute/unmute เองได้)`);

      const player = createAudioPlayer({
        behaviors: { noSubscriber: NoSubscriberBehavior.Play },
      });
      player.on("error", (err) => console.error("TalkbackBot PLAYER ERROR:", err));

      const tbStream = new ContinuousPCM();
      player.play(createAudioResource(tbStream, { inputType: StreamType.Raw }));
      connection.subscribe(player);

      // ทุกเสียงหัวหน้า/รองที่ส่งกลับมา → เล่นในห้อง Leader Room
      talkbackBus.on("pcm", (chunk) => tbStream.feed(chunk));
    } catch (err) {
      console.error(`⛔ ${cfg.name}: ${err.message}`);
      console.error("   👉 เชิญ TalkbackBot เข้าเซิร์ฟเวอร์ก่อน (OAuth2 > bot + Connect/Speak/View Channel)");
    }
  });

  await client.login(cfg.token);
}

// ===========================================================================
//  ตรวจ config กันพลาดก่อนรัน
// ===========================================================================
function validateConfig() {
  const problems = [];
  const isPlaceholder = (v) => !v || v.startsWith("ใส่_");

  if (isPlaceholder(config.leader.channelId))
    problems.push("ยังไม่ได้ใส่ channelId ของ Leader Room ใน config.js");
  if (!config.leader.token) problems.push("ยังไม่ได้ตั้ง LEADER_TOKEN ใน .env");

  const seenTokens = new Map(); // token -> ชื่อบอท (กัน token ซ้ำ)
  const register = (name, token) => {
    if (!token) return;
    if (seenTokens.has(token)) {
      problems.push(
        `token ซ้ำกัน: ${name} ใช้ token เดียวกับ ${seenTokens.get(name) || seenTokens.get(token)} ` +
          `— บอท 1 ตัวอยู่ได้ห้องเดียว ต้องใช้คนละ token`
      );
    } else {
      seenTokens.set(token, name);
    }
  };
  register(config.leader.name, config.leader.token);
  if (config.talkbackBot) register(config.talkbackBot.name, config.talkbackBot.token);

  for (const spk of config.speakers) {
    if (isPlaceholder(spk.channelId))
      problems.push(`ยังไม่ได้ใส่ channelId ของ ${spk.name} ใน config.js`);
    if (!spk.token)
      problems.push(`ยังไม่ได้ตั้ง token ของ ${spk.name} ใน .env (จะถูกข้ามตอนรัน)`);
    register(spk.name, spk.token);
  }

  return problems;
}

// ===========================================================================
//  BOOT
// ===========================================================================
(async () => {
  console.log("🚀 เริ่มระบบ Leader Broadcast...");

  // ค่าเริ่มต้น volume talkback ทุกห้อง = 100% (ปรับสดด้วย /setvoltb ได้)
  for (const spk of config.speakers) roomVolume.set(spk.name, spk.volume ?? 1);

  const problems = validateConfig();
  if (problems.length) {
    console.error("\n❌ พบปัญหาในการตั้งค่า กรุณาแก้ก่อนรัน:");
    for (const p of problems) console.error("   • " + p);
    // ถ้า Leader ใช้ไม่ได้เลย หยุดทันที; ถ้าแค่ speaker บางตัวขาด ปล่อยรันต่อ
    const fatal = problems.some((p) => p.includes("Leader") || p.includes("LEADER_TOKEN"));
    if (fatal) {
      console.error("\n⛔ หยุดทำงาน (ปัญหาฝั่ง Leader)\n");
      process.exit(1);
    }
    console.warn("\n⚠️  จะรันต่อโดยข้ามบอทที่ตั้งค่าไม่ครบ\n");
  }

  try {
    await startLeader();
  } catch (err) {
    console.error("⛔ LeaderBot เริ่มไม่สำเร็จ:", err.message);
    process.exit(1);
  }

  for (const spk of config.speakers) {
    try {
      await startSpeaker(spk);
    } catch (err) {
      // บอทตัวเดียวพังไม่ควรล้มทั้งระบบ
      console.error(`⛔ ${spk.name} เริ่มไม่สำเร็จ:`, err.message);
    }
  }

  try {
    await startTalkbackBot();
  } catch (err) {
    console.error("⛔ TalkbackBot เริ่มไม่สำเร็จ:", err.message);
  }

  console.log("\n============================================================");
  console.log("   ✅ กำลังทำงาน — บอททั้งหมดออนไลน์แล้ว");
  console.log("   พูดในห้อง Leader Room ได้เลย");
  console.log("   ❌ ปิดโปรแกรม: กดปุ่ม X มุมขวาบนของหน้าต่างนี้");
  console.log("============================================================\n");
})();

// ลบ lock เมื่อปิดโปรแกรม
function releaseLock() {
  try {
    if (fs.existsSync(LOCK_FILE) && fs.readFileSync(LOCK_FILE, "utf8").trim() === String(process.pid)) {
      fs.rmSync(LOCK_FILE, { force: true });
    }
  } catch {}
}
process.on("exit", releaseLock);
process.on("SIGINT", () => process.exit(0));
