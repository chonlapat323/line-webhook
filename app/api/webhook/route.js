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
      console.log('[line-webhook] calling-bridge', {
        eventId: inbound.eventId,
        chatType: inbound.chatType,
        chatId: inbound.chatId,
      });

      const aiRes = await askOpenClaw(inbound);
      const replyText = aiRes?.reply || aiRes?.text || aiRes?.message || 'รับข้อความแล้ว แต่ยังตอบกลับไม่ได้';

      console.log('[line-webhook] bridge-ok', {
        eventId: inbound.eventId,
        hasReply: Boolean(replyText),
        preview: String(replyText).slice(0, 120),
      });

      console.log('[line-webhook] replying-line', {
        eventId: inbound.eventId,
        replyLength: String(replyText).length,
      });

      await replyLineMessage(inbound.replyToken, String(replyText).slice(0, 5000));

      console.log('[line-webhook] reply-ok', {
        eventId: inbound.eventId,
      });

      results.push({ eventId: inbound.eventId, ok: true });
    } catch (error) {
      console.error('[line-webhook] failed', {
        eventId: inbound.eventId,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      try {
        console.log('[line-webhook] replying-line-fallback', {
          eventId: inbound.eventId,
        });

        await replyLineMessage(inbound.replyToken, 'ตอนนี้แจ่มใสติดอะไรบางอย่างอยู่ ขออีกแป๊บนะ');

        console.log('[line-webhook] fallback-reply-ok', {
          eventId: inbound.eventId,
        });
      } catch (replyError) {
        console.error('[line-webhook] fallback-reply-failed', {
          eventId: inbound.eventId,
          message: replyError instanceof Error ? replyError.message : String(replyError),
          stack: replyError instanceof Error ? replyError.stack : undefined,
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
