import crypto from 'crypto';

export function verifyLineSignature(rawBody, signature, channelSecret) {
  if (!signature || !channelSecret) return false;

  const expected = crypto
    .createHmac('SHA256', channelSecret)
    .update(rawBody)
    .digest('base64');

  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export function normalizeLineEvent(event) {
  const sourceType = event?.source?.type;
  const chatType = sourceType === 'user' ? 'dm' : sourceType === 'group' ? 'group' : sourceType === 'room' ? 'room' : 'unknown';
  const chatId = event?.source?.groupId || event?.source?.roomId || event?.source?.userId || 'unknown';

  return {
    platform: 'line',
    eventId: event?.webhookEventId || event?.deliveryContext?.timestamp || `${Date.now()}`,
    timestamp: event?.timestamp || Date.now(),
    chatType,
    chatId,
    userId: event?.source?.userId,
    replyToken: event?.replyToken,
    text: event?.message?.type === 'text' ? event.message.text : undefined,
    raw: event,
  };
}

export function shouldRespond(inbound) {
  return Boolean(inbound?.text);
}

function getLineAccessToken() {
  const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error('Missing LINE_CHANNEL_ACCESS_TOKEN');
  }
  return accessToken;
}

export async function replyLineMessage(replyToken, text) {
  const accessToken = getLineAccessToken();

  const response = await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: 'text', text: text || 'โอ๊ะ มีอะไรบางอย่างไม่ครบ เดี๋ยวลองใหม่อีกทีนะ' }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`LINE reply failed (${response.status}): ${body}`);
  }

  return response.json().catch(() => ({ ok: true }));
}

export async function pushLineMessage(to, text) {
  const accessToken = getLineAccessToken();
  if (!to) {
    throw new Error('Missing LINE push target');
  }

  const response = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to,
      messages: [{ type: 'text', text: text || 'โอ๊ะ มีอะไรบางอย่างไม่ครบ เดี๋ยวลองใหม่อีกทีนะ' }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`LINE push failed (${response.status}): ${body}`);
  }

  return response.json().catch(() => ({ ok: true }));
}
