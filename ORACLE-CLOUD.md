# Deploy บน Oracle Cloud (Always Free) — ฟรีตลอดชีพ

> รัน GuildWarBroadcast บน VM ฟรีของ Oracle (รองรับ UDP + รันยาว 24 ชม. ได้)
> เหมาะเมื่อไม่อยากเปิดคอมตัวเอง • Always Free = ไม่เสียเงินแม้รันตลอด

---

## ⚠️ สำคัญที่สุด: อย่าก๊อป node_modules จาก Windows ไป Linux
native module (`@discordjs/opus`, `@snazzah/davey`) เป็นไฟล์เฉพาะ OS/CPU
→ บน VM ต้อง **`npm install` ใหม่** เพื่อให้ได้ binary ของ Linux/ARM
→ อัปโหลดแค่ **source** (relay.js, config.js, .env, package.json, package-lock.json)

---

## ขั้นตอน

### 1. สมัคร Oracle Cloud
- ไป https://www.oracle.com/cloud/free/
- สมัคร (ต้องผูกบัตรเพื่อยืนยันตัว — **Always Free ไม่ตัดเงิน**)
- เลือก **Region ใกล้ผู้ใช้** (ไทย → เลือก Singapore หรือ Tokyo เพื่อ latency ต่ำ) ⭐

### 2. สร้าง VM (Compute Instance)
- เมนู ☰ → **Compute** → **Instances** → **Create Instance**
- **Image:** Ubuntu 22.04
- **Shape:** กด Change Shape → **Ampere (ARM)** → `VM.Standard.A1.Flex`
  - ตั้ง **2 OCPU + 8-12 GB RAM** (อยู่ในโควต้าฟรี 4 OCPU/24GB — เผื่อ 20 ห้องสบาย)
  - *ถ้า ARM เต็ม (ขึ้น out of capacity) → ลองเปลี่ยน Availability Domain หรือใช้ `VM.Standard.E2.1.Micro` (AMD x64, 1GB RAM — พอสำหรับห้องน้อย)*
- **SSH keys:** กด Save Private Key (เก็บไฟล์ `.key` ไว้)
- กด **Create** → รอจน Running แล้วจด **Public IP**

### 3. SSH เข้า VM
```bash
# Windows: ใช้ PowerShell หรือ Git Bash
chmod 600 your-key.key          # (เฉพาะ Mac/Linux/GitBash)
ssh -i your-key.key ubuntu@<PUBLIC_IP>
```

### 4. ติดตั้ง Node 20 + เครื่องมือ build
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs build-essential python3 git
node -v   # ควรขึ้น v20.x
```

### 5. อัปโหลด source ขึ้น VM
**วิธี A — scp (จากเครื่อง Windows, ห้ามรวม node_modules):**
```bash
# รันบนเครื่องตัวเอง (PowerShell ในโฟลเดอร์โปรเจกต์)
scp -i your-key.key relay.js config.js .env package.json package-lock.json build.js ubuntu@<PUBLIC_IP>:~/guild-war-broadcast/
```
*(สร้างโฟลเดอร์ก่อน: บน VM พิมพ์ `mkdir -p ~/guild-war-broadcast`)*

**วิธี B — git** (ถ้าโค้ดอยู่ใน private repo): `git clone` แล้วเอา `.env` มาวางทีหลัง (อย่า push token ขึ้น repo สาธารณะ!)

### 6. ติดตั้ง dependencies (ได้ binary Linux อัตโนมัติ)
```bash
cd ~/guild-war-broadcast
npm install --omit=dev    # ไม่ต้องลง caxa (ใช้ build exe เท่านั้น)
```

### 7. ทดสอบรัน
```bash
npm start
```
ควรเห็นบอท login ครบ + `✅ กำลังทำงาน` → กด `Ctrl+C` เพื่อหยุด

### 8. รันค้าง 24 ชม. ด้วย pm2
```bash
sudo npm install -g pm2
pm2 start relay.js --name guild-war-broadcast
pm2 save
pm2 startup     # ก๊อปคำสั่งที่มันบอกมารันต่อ (ให้รันเองตอน VM reboot)
```
คำสั่งที่ใช้บ่อย:
```bash
pm2 logs guild-war-broadcast     # ดู log สด
pm2 restart guild-war-broadcast  # รีสตาร์ท (หลังแก้ config)
pm2 stop guild-war-broadcast     # หยุด
pm2 status                 # ดูสถานะ
```

### 9. แก้ config ภายหลัง
```bash
nano ~/guild-war-broadcast/config.js   # หรือ .env
pm2 restart guild-war-broadcast
```

---

## เรื่อง Firewall (ปกติไม่ต้องตั้งอะไร)
- บอท **เชื่อมออก** หา Discord อย่างเดียว (outbound) → Oracle เปิด outbound ให้อยู่แล้ว
- **ไม่ต้องเปิด inbound port** ใดๆ (เว้นแต่ทำ web dashboard ค่อยเปิด port นั้น)

## ข้อควรรู้
- **Region สำคัญต่อ latency** — เลือกใกล้ผู้ใช้/ใกล้ Discord voice region
- Always Free รันตลอดได้ไม่มีค่าใช้จ่าย → ไม่ต้องปิดๆ เปิดๆ
- ถ้า VM โดน reclaim (Oracle เอาคืนเมื่อ idle นานมากในบางเคส) → pm2 startup ช่วยให้กลับมารันเอง
- อย่าเปิดเผย `.env` (มี token) — ห้าม push ขึ้น repo สาธารณะ
