# line-webhook

Next.js webhook receiver for LINE Messaging API.

ตอนนี้โปรเจกต์นี้ทำงานเป็น **LINE → Vercel → OpenClaw bridge** แบบ MVP:
- รับ webhook จาก LINE
- verify signature
- normalize event
- ตัดสินใจว่าจะตอบหรือไม่
- ส่งข้อความเข้า OpenClaw bridge endpoint
- reply กลับ LINE

## Endpoint

- `GET /api/webhook`
- `POST /api/webhook`

## Environment Variables

คัดลอกจาก `.env.example` แล้วตั้งค่าจริงใน Vercel / local:

- `LINE_CHANNEL_SECRET`
- `LINE_CHANNEL_ACCESS_TOKEN`
- `OPENCLAW_BRIDGE_URL`
- `INTERNAL_API_TOKEN` (optional แต่แนะนำ)
- `OPENCLAW_TIMEOUT_MS` (optional)

## Current routing rules

- DM (`source.type=user`) → ตอบทุกข้อความ text
- Group/Room → ตอบเมื่อข้อความขึ้นต้นด้วย:
  - `แจ่มใส`
  - `bot`
  - `/ask`

ปรับได้ใน `lib/line.js` ฟังก์ชัน `shouldRespond()`

## OpenClaw bridge contract

Vercel จะ `POST` ไปที่ `OPENCLAW_BRIDGE_URL` ด้วย payload แบบนี้:

```json
{
  "sessionKey": "line:user:Uxxx",
  "message": "prompt text...",
  "metadata": {
    "platform": "line",
    "chatType": "dm",
    "chatId": "Uxxx",
    "userId": "Uxxx",
    "eventId": "...",
    "timestamp": 1234567890
  }
}
```

และคาดหวัง response กลับมาอย่างน้อยหนึ่ง field ต่อไปนี้:

```json
{
  "reply": "ข้อความตอบกลับ"
}
```

หรือ `text` / `message` ก็ได้

## Local Development

```bash
npm install
npm run dev
```

## Deploy to Vercel

1. Push repo ไป GitHub
2. Import เข้า Vercel
3. ตั้ง Environment Variables
4. Deploy
5. ใช้ webhook URL นี้ใน LINE Developers:
   - `https://line-webhook-psi.vercel.app/api/webhook`

## Local bridge added

ตอนนี้ repo นี้มีโฟลเดอร์ `bridge/` เพิ่มแล้ว สำหรับรัน **Local Bridge API**
เพื่อให้ Vercel ส่งข้อความต่อเข้ามายังเครื่อง local ได้

สิ่งที่ bridge ตัวนี้ทำได้แล้ว:
- รับ request จาก Vercel ที่ `POST /line-event`
- ตรวจ bearer token (`INTERNAL_API_TOKEN`)
- มี `GET /health`
- กัน event ซ้ำเบื้องต้น
- ส่งต่อไป downstream local service ได้ถ้าตั้ง `OPENCLAW_LOCAL_URL`
- มี fallback reply ถ้ายังไม่ได้เสียบ OpenClaw adapter จริง

พูดสั้น ๆ: ตอนนี้ "ประตูหน้า" และ "ประตูกลาง" มีแล้ว
เหลือแค่เสียบปลายทางเข้า OpenClaw local/runtime ที่คุณใช้อยู่จริง

ดูต่อที่ `bridge/README.md`
