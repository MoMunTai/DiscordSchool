# EXE — Guild War Broadcast (by KongPlayCh)

เปิด exe = เริ่ม **Web Dashboard อัตโนมัติ** + **เปิด browser ให้เอง** + **บอทออนไลน์ทันที**

## ไฟล์ผลลัพธ์ (`dist/`)
- **GuildWarBroadcast.exe** — ตัวโปรแกรม (Node + บอท + เว็บ + config ฝังในตัวครบ ไฟล์เดียวจบ)

## วิธีใช้
1. **ดับเบิลคลิก `GuildWarBroadcast.exe`**
2. รอบแรกจะขึ้น `Guild War Broadcast - first run, extracting files...` (แตกไฟล์ ~20-40 วิ ครั้งเดียว รอบต่อไปเร็ว)
3. หน้าต่าง console จะโชว์:
   ```
   🎙  Guild War Broadcast — Control Panel (by KongPlayCh)
   🌐  http://localhost:4000
   ❌  ปิดโปรแกรม: กดปุ่ม X มุมขวาบน
   ```
4. **browser จะเปิดหน้า Dashboard ให้อัตโนมัติ** และบอทเริ่มออนไลน์เอง
   - บนหน้าเว็บ: ดูสถานะ บอท x/total • ห้อง x/total • ไฟ **ON AIR** ตอนมีคนพูด
   - ปุ่ม ▶ เริ่ม / ■ หยุด / ↻ รีสตาร์ท • ปรับเสียง talkback รายห้อง • ดู log สด
5. **ปิดโปรแกรม:** กดปุ่ม **X มุมขวาบน** ของหน้าต่าง console (หรือ Ctrl+C) — บอทจะถูกหยุดตามไปด้วย

> เปิดเว็บซ้ำได้จากเครื่องอื่นในวง LAN เดียวกัน: `http://<IP-เครื่องนี้>:4000`

## กันเปิดซ้ำ
ถ้าเผลอเปิด exe ซ้ำตอนตัวแรกยังรัน → ตัวที่ 2 จะแจ้ง "เปิดอยู่แล้ว" แล้วปิดเอง (กัน token ชน)

## เปิดอัตโนมัติตอน Windows บูต (ออปชัน)
1. `Win + R` → พิมพ์ `shell:startup` → Enter
2. ก๊อป **shortcut ของ GuildWarBroadcast.exe** ไปวาง

## config ฝังในตัว exe
- token / ห้อง / role ถูกฝังตอน build → exe ไฟล์เดียวรันได้เลย ไม่ต้องมีไฟล์ข้างนอก
- **เปลี่ยน token/ห้อง/role** → แก้ `config.js` / `.env` ในโปรเจกต์ → `npm run build` ใหม่
- ปรับ volume สด: บนเว็บ หรือ slash `/setvoltb`, `/setvolall`, `/voltb` (ไม่ต้อง build ใหม่)

## build
```
npm run build       → dist/GuildWarBroadcast.exe (เปิดแล้ว start web + บอท อัตโนมัติ)
```
โหมด dev (รันจากโปรเจกต์ ใช้ config.js/.env ในโปรเจกต์):
```
npm run web         → เปิด Dashboard (ตั้ง AUTO_START=1 / AUTO_OPEN=1 เพื่อ autostart+เปิด browser)
npm start           → รันบอทตรงๆ ใน console (ไม่ผ่านเว็บ)
```

## ย้ายไปเครื่องอื่น
- ก๊อปแค่ **GuildWarBroadcast.exe** ไปเครื่อง **Windows 64-bit** ได้เลย (ไม่ต้องมี config/Node)
- กฎเหล็ก: **รันได้ที่เดียวเท่านั้น** (token ชนถ้ารัน 2 เครื่อง — มีตัวกันเปิดซ้ำในเครื่องเดียวกันแล้ว)
