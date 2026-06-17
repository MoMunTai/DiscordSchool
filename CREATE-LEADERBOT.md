# วิธีสร้าง LeaderBot ให้ถูกต้อง

> LeaderBot คือบอทที่ "นั่งฟัง" เสียงอาจารย์ใหญ่ในห้อง **Leader Room**
> แล้วส่งต่อ (relay) ไปทุกห้องเรียน — เป็นหัวใจของระบบ
>
> ขั้นตอนเหมือน A2Bot เกือบทั้งหมด ต่างกันแค่ "หน้าที่" และ "เรื่อง Intent" ด้านล่าง

## ขั้นตอน

### 1. สร้าง Application
1. ไปที่ https://discord.com/developers/applications
2. กดปุ่ม **New Application** (มุมขวาบน)
3. ตั้งชื่อ `LeaderBot` → กด **Create**

### 2. เปิดใช้ Bot + เอา Token
1. เมนูซ้าย เลือก **Bot**
2. กด **Reset Token** → ยืนยัน → **Copy** token
   - ⚠️ Token โชว์ครั้งเดียว! ปิดหน้าไปต้อง Reset ใหม่
   - ⚠️ เอา **Token** เท่านั้น — ไม่ใช่ Application ID / Public Key
3. วางใน `.env`:
   ```
   LEADER_TOKEN=วาง_token_ตรงนี้
   ```

### 3. ⭐ Intents — ไม่ต้องเปิดอะไรเลย
ในหน้า **Bot** เลื่อนลงมาส่วน **Privileged Gateway Intents**:

| Intent | ตั้งค่า |
|---|---|
| Presence Intent | ❌ ปิด |
| Server Members Intent | ❌ ปิด |
| Message Content Intent | ❌ ปิด |

> การ "ฟังเสียง" ใช้ intent `GuildVoiceStates` ซึ่งเป็น intent ธรรมดา (ไม่ใช่ privileged)
> โค้ดเปิดให้แล้วในตัว — ไม่ต้องไปตั้งใน Portal

### 4. ปิด "Requires OAuth2 Code Grant"
- ในหน้า **Bot** หา **Requires OAuth2 Code Grant** → ต้อง **ปิด (OFF)**

### 5. เชิญเข้าเซิร์ฟเวอร์ (สิทธิ์ที่ต้องมี)
1. เมนูซ้าย **OAuth2** → **OAuth2 URL Generator**
2. **SCOPES** ติ๊ก ✅ `bot`
3. **BOT PERMISSIONS** ติ๊ก ✅:
   - `Connect` (เข้าห้องเสียง)
   - `Speak` (จำเป็นสำหรับ session เสียง แม้ Leader จะ self-mute)
   - `View Channel`
4. ก๊อปลิงก์ล่างสุด → เปิดเบราว์เซอร์ → เลือก **เซิร์ฟเวอร์เดียวกับบอทห้องเรียน** → Authorize

### 6. สิทธิ์ในห้อง Leader Room
- LeaderBot ต้อง **Connect** เข้าห้อง Leader Room ได้
- ถ้าห้องล็อกด้วย role ต้องให้ role ของ LeaderBot มีสิทธิ์ Connect ที่ห้องนั้น

## ✅ เช็คลิสต์
- [ ] ใช้ **Token** (ไม่ใช่ Application ID)
- [ ] `LEADER_TOKEN` ใน `.env` ตรงกับ LeaderBot ตัวนี้
- [ ] **ไม่ต้องเปิด** Privileged Intent ทั้ง 3 ตัว
- [ ] token ไม่ซ้ำกับ A1Bot / A2Bot
- [ ] เชิญเข้า **เซิร์ฟเวอร์เดียวกับบอทตัวอื่น**
- [ ] มีสิทธิ์ Connect + Speak ในห้อง Leader Room
- [ ] `config.leader.channelId` = Channel ID ของห้อง Leader Room

## หมายเหตุพิเศษของ LeaderBot
- ในโค้ด LeaderBot ตั้ง `selfDeaf: false` ตั้งใจไว้ — **ห้ามแก้เป็น true**
  เพราะถ้า deaf จะ "ไม่ได้ยิน" = รับเสียงไม่ได้ = relay ไม่ทำงาน
- LeaderBot ตั้ง `selfMute: true` (ตัวมันไม่ต้องพูด แค่ฟัง)
