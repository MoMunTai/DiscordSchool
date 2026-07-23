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
    channelId: "1515429349011230811",
  },

  // TalkbackBot: อยู่ในห้อง Leader Room เล่นเสียงหัวหน้า/รองจากทุกห้อง "ตลอดเวลา"
  //  (emergency monitor — Leader คุมการได้ยินเองด้วยการ mute/unmute บอทตัวนี้ในแอป)
  //  ต้องสร้างบอทใหม่อีกตัว + เชิญเข้าเซิร์ฟเวอร์ + ใส่ TALKBACK_TOKEN ใน .env
  //  channelId = ห้องเดียวกับ Leader Room
  talkbackBot: {
    name: "TalkbackBot",
    token: process.env.TALKBACK_TOKEN,
    channelId: "1515429349011230811",
  },

  // ห้องแชต (text) สำหรับวางปุ่มเปิด/ปิด Talkback (เช่น #bot-log)
  // วิธีหา: คลิกขวาห้องแชต > Copy Channel ID
  controlChannelId: "ใส่_TEXT_CHANNEL_ID_สำหรับปุ่ม",

  // ⭐ Role ที่อนุญาตให้ "พูดกลับหา Leader" ได้ (ใช้ร่วมทุกห้อง)
  //  ใส่ Role ID ของ หัวหน้าห้อง / รองหัวหน้าห้อง
  //  วิธีหา: Server Settings > Roles > คลิกขวา role > Copy Role ID (เปิด Developer Mode ก่อน)
  //  เว้นว่าง [] = ไม่กรองด้วย role (ไปดู talkers รายคนแทน; ถ้าว่างทั้งคู่ = ทุกคนในห้องผ่าน)
  talkerRoleIds: [
    "1516265385773629633", //HeadParty
  ],

  // บอทตัวที่ "พูด" — แต่ละห้องเรียน 1 ตัว (เริ่มเทสแค่ A1, A2 ก่อน)
  //  talkers = userId รายคน (ออปชันเสริม) อนุญาตเฉพาะห้องนั้น นอกเหนือจาก role ข้างบน
  //  เกณฑ์ผ่าน: มี role ใน talkerRoleIds  หรือ  userId อยู่ใน talkers
  speakers: [
    {
      name: "A1Bot",
      token: process.env.A1_TOKEN,
      channelId: "1515941288946438195",
      talkers: [], // เช่น ["123...หัวหน้า", "456...รอง"]
    },
    {
      name: "A2Bot",
      token: process.env.A2_TOKEN,
      channelId: "1433460040316227714",
      talkers: [],
    },
    {
      name: "A3Bot",
      token: process.env.A3_TOKEN,
      channelId: "1433460066094419989",
      talkers: [],
    },
    {
      name: "A4Bot",
      token: process.env.A4_TOKEN,
      channelId: "1433460095483904171",
      talkers: [],
    },
    // {
    //   name: "A5Bot",
    //   token: process.env.A5_TOKEN,
    //   channelId: "1448310614748299315",
    //   talkers: [],
    // },
    // {
    //   name: "A6Bot",
    //   token: process.env.A6_TOKEN,
    //   channelId: "1448310664421707827",
    //   talkers: [],
    // },
    // {
    //   name: "A7Bot",
    //   token: process.env.A7_TOKEN,
    //   channelId: "1466061704138850335",
    //   talkers: [],
    // },
    // {
    //   name: "A8Bot",
    //   token: process.env.A8_TOKEN,
    //   channelId: "1466061828969861214",
    //   talkers: [],
    // },

    // {
    //   name: "B1Bot",
    //   token: process.env.B1_TOKEN,
    //   channelId: "1466061894266785792",
    //   talkers: [],
    // },
    // {
    //   name: "B2Bot",
    //   token: process.env.B2_TOKEN,
    //   channelId: "1466061930480275552",
    //   talkers: [],
    // },
    // {
    //   name: "B3Bot",
    //   token: process.env.B3_TOKEN,
    //   channelId: "1466061957445718167",
    //   talkers: [],
    // },
    // {
    //   name: "B4Bot",
    //   token: process.env.B4_TOKEN,
    //   channelId: "1466061979608154132",
    //   talkers: [],
    // },
    // {
    //   name: "B5Bot",
    //   token: process.env.B5_TOKEN,
    //   channelId: "1466062015536566282",
    //   talkers: [],
    // },
    // {
    //   name: "B6Bot",
    //   token: process.env.B6_TOKEN,
    //   channelId: "1466062071593697281",
    //   talkers: [],
    // },
    // {
    //   name: "B7Bot",
    //   token: process.env.B7_TOKEN,
    //   channelId: "1515941745374793788",
    //   talkers: [],
    // },
    // {
    //   name: "B8Bot",
    //   token: process.env.B8_TOKEN,
    //   channelId: "1515941772990087298",
    //   talkers: [],
    // },

    // {
    //   name: "C1Bot",
    //   token: process.env.C1_TOKEN,
    //   channelId: "1515941867500601414",
    //   talkers: [],
    // },
    // {
    //   name: "C2Bot",
    //   token: process.env.C2_TOKEN,
    //   channelId: "1515942005992329299",
    //   talkers: [],
    // },
    // {
    //   name: "C3Bot",
    //   token: process.env.C3_TOKEN,
    //   channelId: "1515942041220288573",
    //   talkers: [],
    // },
    // {
    //   name: "C4Bot",
    //   token: process.env.C4_TOKEN,
    //   channelId: "1515942068264898661",
    //   talkers: [],
    // },
  ],
};
