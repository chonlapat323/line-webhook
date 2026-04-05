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
      const aiRes = await askOpenClaw(inbound);
      const replyText = aiRes?.reply || aiRes?.text || aiRes?.message || 'รับข้อความแล้ว แต่ยังตอบกลับไม่ได้';

      await replyLineMessage(inbound.replyToken, String(replyText).slice(0, 5000));

      results.push({ eventId: inbound.eventId, ok: true });
    } catch (error) {
      console.error('[line-webhook] failed', {
        eventId: inbound.eventId,
        message: error instanceof Error ? error.message : String(error),
      });

      try {
        await replyLineMessage(inbound.replyToken, 'ตอนนี้แจ่มใสติดอะไรบางอย่างอยู่ ขออีกแป๊บนะ');
      } catch (replyError) {
        console.error('[line-webhook] fallback-reply-failed', {
          eventId: inbound.eventId,
          message: replyError instanceof Error ? replyError.message : String(replyError),
        });
      }

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
