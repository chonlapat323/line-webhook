# Local Bridge for OpenClaw

ตัวนี้คือฝั่ง local ที่ Vercel จะยิงเข้ามา แล้วค่อยส่งต่อเข้า OpenClaw local อีกชั้นหนึ่ง

## Current behavior

ตอนนี้ bridge นี้ทำงานได้แล้วในฐานะ:
- endpoint รับ request จาก Vercel
- ตรวจ bearer token
- dedupe event เบื้องต้น
- health check
- fallback reply ถ้ายังไม่ได้ต่อ downstream จริง

ถ้าจะต่อเข้ากับ OpenClaw local จริง มี 2 ทาง:

1. ตั้ง `OPENCLAW_LOCAL_URL` ให้ชี้ไป local adapter/service ที่คุณมีอยู่
2. แก้ `server.js` ในฟังก์ชัน `callDownstream()` ให้ส่งเข้า OpenClaw runtime ที่คุณใช้จริง

## Endpoints

- `GET /health`
- `POST /line-event`

## Expected request from Vercel

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

## Response shape

```json
{
  "ok": true,
  "reply": "ข้อความตอบกลับ"
}
```

## Run locally

```bash
cd bridge
npm install
npm run dev
```

## Tunnel example

Expose this local service with a tunnel, then set Vercel env:

- `OPENCLAW_BRIDGE_URL=https://your-tunnel-url/line-event`
- `INTERNAL_API_TOKEN=...`

## Important

bridge นี้ยังไม่ได้ “ยิงเข้า OpenClaw runtime จริง” อัตโนมัติถ้าคุณยังไม่มี local adapter ปลายทาง
แต่ตอนนี้โครงที่จำเป็นครบแล้ว และพร้อมเสียบ downstream ต่อ
