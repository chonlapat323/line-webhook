import crypto from 'crypto';

function verifyLineSignature(rawBody, signature, channelSecret) {
  if (!signature || !channelSecret) return false;

  const expected = crypto
    .createHmac('SHA256', channelSecret)
    .update(rawBody)
    .digest('base64');

  return expected === signature;
}

export async function POST(request) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-line-signature');
  const channelSecret = process.env.LINE_CHANNEL_SECRET;

  if (!verifyLineSignature(rawBody, signature, channelSecret)) {
    return Response.json({ ok: false, error: 'Invalid signature' }, { status: 401 });
  }

  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  console.log('LINE webhook event:', JSON.stringify(body, null, 2));

  return Response.json({ ok: true });
}

export async function GET() {
  return Response.json({ ok: true, message: 'LINE webhook endpoint is running' });
}
