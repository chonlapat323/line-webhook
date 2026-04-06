import { askOpenClaw } from '@/lib/openclaw';
import {
  normalizeLineEvent,
  replyLineMessage,
  shouldRespond,
  verifyLineSignature,
} from '@/lib/line';

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

  const events = Array.isArray(body?.events) ? body.events : [];
  const results = [];

  for (const event of events) {
    const inbound = normalizeLineEvent(event);

    console.log('[line-webhook] inbound', {
      eventId: inbound.eventId,
      chatType: inbound.chatType,
      chatId: inbound.chatId,
      userId: inbound.userId,
      hasText: Boolean(inbound.text),
    });

    if (!shouldRespond(inbound)) {
      results.push({ eventId: inbound.eventId, skipped: true, reason: 'routing-rule' });
      continue;
    }

    if (!inbound.replyToken) {
      results.push({ eventId: inbound.eventId, skipped: true, reason: 'missing-reply-token' });
      continue;
    }

    try {
      console.log('[line-webhook] replying-line-ack', {
        eventId: inbound.eventId,
      });

      await replyLineMessage(inbound.replyToken, 'รับแล้ว เดี๋ยวแจ่มใสดูให้ ✨');

      console.log('[line-webhook] ack-ok', {
        eventId: inbound.eventId,
      });

      const bridgeAck = await askOpenClaw(inbound, { path: '/line-event-async', timeoutMs: 10000 });

      console.log('[line-webhook] async-accepted', {
        eventId: inbound.eventId,
        bridgeAck,
      });

      results.push({ eventId: inbound.eventId, ok: true, mode: 'async', accepted: true });
    } catch (error) {
      console.error('[line-webhook] ack-failed', {
        eventId: inbound.eventId,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      results.push({
        eventId: inbound.eventId,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return Response.json({ ok: true, results });
}

export async function GET() {
  return Response.json({
    ok: true,
    message: 'LINE webhook endpoint is running',
    needs: ['LINE_CHANNEL_SECRET', 'LINE_CHANNEL_ACCESS_TOKEN', 'OPENCLAW_BRIDGE_URL'],
  });
}
