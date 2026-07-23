# วิธีรันบนเครื่องอื่น

> เวอร์ชันนี้แก้ครบแล้ว: **DAVE/E2EE support** (`@discordjs/voice` 0.19.2 + `@snazzah/davey`)
> และ **group fix** (บอทหลายตัวใน guild เดียวกันแยก connection ถูกต้อง)

## สิ่งที่ต้องมีบนเครื่องใหม่
- **Node.js v20 ขึ้นไป** (แนะนำ v22 LTS เพราะ `@discordjs/voice` 0.19 อยากได้ ≥22.12 — v20 รันได้แต่มี warning)
- เป็น **Windows 64-bit** เหมือนเครื่องนี้ → แตกแล้วรันได้เลย ไม่ต้อง `npm install`
  (เพราะมี native module: `@discordjs/opus`, `@snazzah/davey` ที่ compile มาให้แล้ว)

## ⚠️ กฎเหล็ก: รันได้ "ที่เดียว" เท่านั้น
ห้ามรัน `npm start` พร้อมกัน 2 เครื่อง/2 หน้าต่าง! เพราะบอทใช้ token ชุดเดียวกัน
ถ้ารันซ้อน บอทจะแย่ง token เด้งสลับห้องมั่ว → **ปิดของเครื่องเดิมก่อนเสมอ**

## ขั้นตอน
1. แตกไฟล์ zip (เช่นไว้ที่ `C:\GuildWarBroadcast`)
2. เปิด **PowerShell** ในโฟลเดอร์นั้น
3. (ออปชัน) เช็ก UDP ออกได้:
   ```
   node check-udp.js
   ```
4. รันบอท:
   ```
   npm start
   ```
5. **รีเฟรช Discord (Ctrl+R)** → ควรเห็นบอทแยกห้องครบ:
   - Leader Room → LeaderBot
   - A1 → A1Bot
   - A2 → A2Bot
6. เข้าไปพูดในห้อง Leader Room → ได้ยินใน A1, A2

## ถ้า `npm start` แล้ว error เรื่อง opus / davey / module
แปลว่า Node คนละเวอร์ชัน/คนละ OS กับที่แพ็กมา → rebuild native module ด้วย:
```
npm install
```
(ต้องมีเน็ต; บน Windows อาจต้องมี Build Tools)

## ไฟล์ token (.env)
- `.env` มี token บอททั้ง 3 ตัวอยู่แล้ว — แพ็กไปด้วย ไม่ต้องตั้งใหม่
- ⚠️ อย่าแชร์ `.env` ให้ใคร (มี token ลับ)

## ขยายเป็น A1-A8 / B1-B8
1. สร้างบอทเพิ่ม → ใส่ token ใน `.env` (เช่น `A3_TOKEN=...`)
2. เปิดบรรทัดที่ comment ไว้ใน `config.js` + ใส่ channelId
   (group แยกอัตโนมัติตามชื่อบอท ไม่ต้องตั้งเพิ่ม)
