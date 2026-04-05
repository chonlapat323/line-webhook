export function buildSessionKey(inbound) {
  if (inbound.chatType === 'dm') {
    return `line:user:${inbound.userId || inbound.chatId}`;
  }
  return `line:${inbound.chatType}:${inbound.chatId}`;
}

export function buildPrompt(inbound) {
  return [
    'You are responding through a LINE webhook bridge managed by Vercel.',
    `Platform: ${inbound.platform}`,
    `Chat type: ${inbound.chatType}`,
    `Chat id: ${inbound.chatId}`,
    `Sender id: ${inbound.userId || 'unknown'}`,
    'If this is a group/room, answer only to the current message and keep it concise.',
    `User message: ${inbound.text || ''}`,
  ].join('\n');
}

export async function askOpenClaw(inbound) {
  const bridgeUrl = process.env.OPENCLAW_BRIDGE_URL;
  const token = process.env.INTERNAL_API_TOKEN;
  const timeoutMs = Number(process.env.OPENCLAW_TIMEOUT_MS || 8000);

  if (!bridgeUrl) {
    throw new Error('Missing OPENCLAW_BRIDGE_URL');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(bridgeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        sessionKey: buildSessionKey(inbound),
        message: buildPrompt(inbound),
        metadata: {
          platform: inbound.platform,
          chatType: inbound.chatType,
          chatId: inbound.chatId,
          userId: inbound.userId,
          eventId: inbound.eventId,
          timestamp: inbound.timestamp,
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenClaw bridge failed (${response.status}): ${body}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}
