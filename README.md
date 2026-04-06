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

## Local bridge

เพื่อให้แยก deploy และแยก GitHub repo ชัดเจน ฝั่ง Local Bridge API ถูกแยกออกไปเป็นอีกโปรเจกต์แล้ว:

- `C:\project\openclaw-local-bridge`

ดังนั้นสถาปัตยกรรมตอนนี้คือ:
- `linewebhook` = ฝั่ง Vercel / LINE webhook receiver
- `openclaw-local-bridge` = ฝั่ง local ที่รับ request จาก Vercel แล้วค่อยต่อเข้า OpenClaw

สิ่งที่ `linewebhook` ต้องรู้มีแค่นี้:
- `OPENCLAW_BRIDGE_URL=https://your-tunnel-url/line-event`
- `INTERNAL_API_TOKEN=...`

โดย `OPENCLAW_BRIDGE_URL` ต้องชี้ไปยังโปรเจกต์ local bridge ที่เปิดผ่าน tunnel ไว้
