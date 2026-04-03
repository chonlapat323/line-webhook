# line-webhook

Next.js webhook receiver for LINE Messaging API.

## Endpoint

- `GET /api/webhook`
- `POST /api/webhook`

## Environment Variables

- `LINE_CHANNEL_SECRET`
- `LINE_CHANNEL_ACCESS_TOKEN`

## Local Development

```bash
npm install
npm run dev
```

## Deploy to Vercel

1. Push this repo to GitHub
2. Import to Vercel
3. Add environment variables
4. Deploy
5. Use `https://your-project.vercel.app/api/webhook` in LINE Developers
