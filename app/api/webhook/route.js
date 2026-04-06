import { askOpenClaw } from '@/lib/openclaw';
import {
  normalizeLineEvent,
  pushLineMessage,
  replyLineMessage,
  shouldRespond,
  verifyLineSignature,
} from '@/lib/line';

function getPushTarget(inbound) {
  if (inbound.chatType === 'group' || inbound.chatType === 'room') return inbound.chatId;
  return inbound.userId || inbound.chatId;
}

async function processAsyncReply(inbound) {
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

    const pushTarget = getPushTarget(inbound);

    console.log('[line-webhook] pushing-line', {
      eventId: inbound.eventId,
      pushTarget,
      replyLength: String(replyText).length,
    });

    await pushLineMessage(pushTarget, String(replyText).slice(0, 5000));

    console.log('[line-webhook] push-ok', {
      eventId: inbound.eventId,
      pushTarget,
    });
  } catch (error) {
    console.error('[line-webhook] async-failed', {
      eventId: inbound.eventId,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    try {
      const pushTarget = getPushTarget(inbound);
      await pushLineMessage(pushTarget, 'ตอนนี้แจ่มใสติดอะไรบางอย่างอยู่ ขออีกแป๊บนะ');
      console.log('[line-webhook] async-fallback-push-ok', {
        eventId: inbound.eventId,
        pushTarget,
      });
    } catch (pushError) {
      console.error('[line-webhook] async-fallback-push-failed', {
        eventId: inbound.eventId,
        message: pushError instanceof Error ? pushError.message : String(pushError),
        stack: pushError instanceof Error ? pushError.stack : undefined,
      });
    }
  }
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

      const asyncWork = processAsyncReply(inbound);
      if (typeof request.waitUntil === 'function') {
        request.waitUntil(asyncWork);
      } else {
        asyncWork.catch((error) => {
          console.error('[line-webhook] detached-async-failed', {
            eventId: inbound.eventId,
            message: error instanceof Error ? error.message : String(error),
          });
        });
      }

      results.push({ eventId: inbound.eventId, ok: true, mode: 'async' });
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
