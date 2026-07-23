// ===========================================================================
//  ตั้งค่าห้อง + บอท ทั้งหมดที่นี่ที่เดียว
//  วิธีหา Channel ID: เปิด Discord > User Settings > Advanced > เปิด Developer Mode
//  แล้วคลิกขวาที่ห้องเสียง > Copy Channel ID
// ===========================================================================

module.exports = {
  // บอทตัวที่ "ฟัง" เสียงอาจารย์ใหญ่ในห้อง Leader Room
  leader: {
    name: "LeaderBot",
    token: process.env.LEADER_TOKEN,
    channelId: "1529704313931305063",
  },

  // TalkbackBot: อยู่ในห้อง Leader Room เล่นเสียงหัวหน้า/รองจากทุกห้อง "ตลอดเวลา"
  //  (emergency monitor — Leader คุมการได้ยินเองด้วยการ mute/unmute บอทตัวนี้ในแอป)
  //  ต้องสร้างบอทใหม่อีกตัว + เชิญเข้าเซิร์ฟเวอร์ + ใส่ TALKBACK_TOKEN ใน .env
  //  channelId = ห้องเดียวกับ Leader Room
  talkbackBot: {
    name: "TalkbackBot",
    token: process.env.TALKBACK_TOKEN,
    channelId: "1529704313931305063",
  },

  // ห้องแชต (text) สำหรับวางปุ่มเปิด/ปิด Talkback (เช่น #bot-log)
  // วิธีหา: คลิกขวาห้องแชต > Copy Channel ID
  controlChannelId: "ใส่_TEXT_CHANNEL_ID_สำหรับปุ่ม",

  // ⭐ Role ที่อนุญาตให้ "พูดกลับหา Leader" ได้ (ใช้ร่วมทุกห้อง)
  //  ใส่ Role ID ของ หัวหน้าห้อง / รองหัวหน้าห้อง
  //  วิธีหา: Server Settings > Roles > คลิกขวา role > Copy Role ID (เปิด Developer Mode ก่อน)
  //  เว้นว่าง [] = ไม่กรองด้วย role (ไปดู talkers รายคนแทน; ถ้าว่างทั้งคู่ = ทุกคนในห้องผ่าน)
  talkerRoleIds: [
    "1529732420490756136", //HeadParty
  ],

  // ⭐ ความลึก buffer เสียง (1 เฟรม = 20ms) — สมดุลระหว่าง "ดีเลย์" กับ "ความนิ่ง"
  //  3 = ดีเลย์ต่ำสุด (เครื่องแรง + สาย LAN เท่านั้น ไม่งั้นเสียงสะดุด)
  //  6 = นิ่งขึ้นมาก ดีเลย์เพิ่มแค่ ~0.06 วิ (แนะนำ)   10 = นิ่งสุด สำหรับเครื่อง/เน็ตอ่อน
  bufferFrames: 6,

  // บอทตัวที่ "พูด" — แต่ละห้อง 1 ตัว
  //  name    = ชื่อบอท ผูกกับ token ใน .env — ★ ห้ามเปลี่ยน
  //  label   = "ชื่อห้อง" ที่โชว์บนหน้าเว็บ/คำสั่ง — ตั้งตามผังห้องของดิสนี้ได้อิสระ (เช่น "B1")
  //            ปุ่มกลุ่มบนเว็บสร้างจากอักษรตัวแรกของ label อัตโนมัติ (A/B/C/D/...)
  //  talkers = userId รายคน (ออปชันเสริม) อนุญาตเฉพาะห้องนั้น นอกเหนือจาก role ข้างบน
  //            เกณฑ์ผ่าน: มี role ใน talkerRoleIds  หรือ  userId อยู่ใน talkers
  speakers: [
    {
      name: "A1Bot",
      label: "A1",
      token: process.env.A1_TOKEN,
      channelId: "1364182983082377277",
      talkers: [],
    },
    {
      name: "A2Bot",
      label: "A2",
      token: process.env.A2_TOKEN,
      channelId: "1364183211059576904",
      talkers: [],
    },
    {
      name: "A3Bot",
      label: "A3",
      token: process.env.A3_TOKEN,
      channelId: "1364183266047033384",
      talkers: [],
    },
    {
      name: "A4Bot",
      label: "A4",
      token: process.env.A4_TOKEN,
      channelId: "1418743382817378374",
      talkers: [],
    },
    {
      name: "A5Bot",
      label: "A5",
      token: process.env.A5_TOKEN,
      channelId: "1418743409568649329",
      talkers: [],
    },
    {
      name: "A6Bot",
      label: "B1",
      token: process.env.A6_TOKEN,
      channelId: "1418743435522740346",
      talkers: [],
    },
    {
      name: "A7Bot",
      label: "B2",
      token: process.env.A7_TOKEN,
      channelId: "1529737575697350696",
      talkers: [],
    },
    {
      name: "A8Bot",
      label: "B3",
      token: process.env.A8_TOKEN,
      channelId: "1529737699181854862",
      talkers: [],
    },
    {
      name: "B1Bot",
      label: "B4",
      token: process.env.B1_TOKEN,
      channelId: "1529737730102399047",
      talkers: [],
    },
    {
      name: "B2Bot",
      label: "B5",
      token: process.env.B2_TOKEN,
      channelId: "1529737765540069417",
      talkers: [],
    },
    {
      name: "B3Bot",
      label: "C1",
      token: process.env.B3_TOKEN,
      channelId: "1529755229506113587",
      talkers: [],
    },
    {
      name: "B4Bot",
      label: "C2",
      token: process.env.B4_TOKEN,
      channelId: "1529755463686819911",
      talkers: [],
    },
    {
      name: "B5Bot",
      label: "C3",
      token: process.env.B5_TOKEN,
      channelId: "1529755516492840980",
      talkers: [],
    },
    {
      name: "B6Bot",
      label: "C4",
      token: process.env.B6_TOKEN,
      channelId: "1529755563175444481",
      talkers: [],
    },
    {
      name: "B7Bot",
      label: "C5",
      token: process.env.B7_TOKEN,
      channelId: "1529755615243538463",
      talkers: [],
    },
    {
      name: "B8Bot",
      label: "D1",
      token: process.env.B8_TOKEN,
      channelId: "1529755756516085901",
      talkers: [],
    },
    {
      name: "C1Bot",
      label: "D2",
      token: process.env.C1_TOKEN,
      channelId: "1529755804222361676",
      talkers: [],
    },
    {
      name: "C2Bot",
      label: "D3",
      token: process.env.C2_TOKEN,
      channelId: "1529755856126738543",
      talkers: [],
    },
    {
      name: "C3Bot",
      label: "D4",
      token: process.env.C3_TOKEN,
      channelId: "1529755893724610560",
      talkers: [],
    },
    {
      name: "C4Bot",
      label: "D5",
      token: process.env.C4_TOKEN,
      channelId: "1529755932030930985",
      talkers: [],
    },
  ],
};
