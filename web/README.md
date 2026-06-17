# Web Dashboard — คุมบอทผ่าน browser

คุม DiscordSchool ผ่านหน้าเว็บ: เริ่ม/หยุด/รีสตาร์ท + ปรับ volume + ดู log สด
(ไม่ต้อง SSH / ไม่ต้องเปิด console) — ใช้ได้ทั้งบนคอมและบน cloud (Oracle)

## รัน
```
npm run web
```
เปิด browser → **http://localhost:3000**

ตัวเลือก (env):
- `PORT=8080` — เปลี่ยนพอร์ต
- `WEB_PASSWORD=mysecret` — ตั้งรหัสผ่าน (แนะนำมากถ้าเปิดบน cloud/public)

ตัวอย่างบน Linux/cloud:
```
WEB_PASSWORD=mysecret PORT=3000 npm run web
```

## โครงสร้าง
```
web/
├── server.js          ← Node http + ws, spawn ../relay.js เป็น child
└── public/index.html  ← หน้า dashboard (หน้าเดียวจบ)
```
- backend (บอท) = `../relay.js` เดิม (ไม่แก้ตรรกะ)
- web คุม relay ผ่าน: spawn/kill + ส่งคำสั่ง volume ทาง stdin

## ฟีเจอร์
| ส่วน | ทำอะไร |
|---|---|
| สถานะ | ออนไลน์/หยุด, จำนวนบอท, ห้องพร้อม (อัปเดตสด) |
| ▶ เริ่ม / ■ หยุด / ↻ รีสตาร์ท | คุมบอท |
| ปรับเสียง | ตั้งทุกห้องพร้อมกัน หรือรายห้อง (0–2.0) |
| Log สด | สตรีมผ่าน WebSocket |

## ใช้บน cloud (Oracle) — เปิดให้เข้าจากภายนอก
1. รัน `WEB_PASSWORD=xxxx npm run web` (ตั้งรหัสเสมอ!)
2. เปิด **inbound port 3000** ใน Oracle:
   - Security List ของ VCN → Add Ingress Rule → TCP port 3000
   - (หรือใช้ Caddy ทำ HTTPS + reverse proxy แล้วเปิดแค่ 443)
3. เข้าผ่าน `http://<VM-PUBLIC-IP>:3000`

> ⚠️ ถ้าเปิด public **ต้องตั้ง WEB_PASSWORD** เสมอ กันคนอื่นมาคุมบอท

## หมายเหตุ
- web spawn relay → ใช้ single-instance lock ร่วมกัน: รัน web **หรือ** exe/`npm start` อย่างใดอย่างหนึ่ง (token ชุดเดียว)
- ปิด server: กด Ctrl+C (บอทจะถูกหยุดด้วย)
