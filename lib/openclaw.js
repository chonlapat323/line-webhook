export function buildSessionKey(inbound) {
  if (inbound.chatType === 'dm') {
    return `line:user:${inbound.userId || inbound.chatId}`;
  }
  return `line:${inbound.chatType}:${inbound.chatId}`;
}

export function buildPrompt(inbound) {
  const text = String(inbound.text || '').trim();
  const prefix = inbound.chatType === 'dm'
    ? 'Reply briefly and helpfully in Thai unless the user clearly uses another language.'
    : 'Reply briefly in Thai to only the current message. Keep it concise for a LINE group.';

  return `${prefix}\n\nUser: ${text}`;
}

export async function askOpenClaw(inbound) {
  const bridgeUrl = process.env.OPENCLAW_BRIDGE_URL;
  const token = process.env.INTERNAL_API_TOKEN;
  const timeoutMs = Number(process.env.OPENCLAW_TIMEOUT_MS || 20000);

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
