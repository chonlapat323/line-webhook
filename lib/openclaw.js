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
    console.log('[line-webhook] bridge-request', {
      bridgeUrl,
      sessionKey: buildSessionKey(inbound),
      timeoutMs,
      hasToken: Boolean(token),
    });

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

    const raw = await response.text();

    console.log('[line-webhook] bridge-response', {
      status: response.status,
      ok: response.ok,
      preview: raw.slice(0, 300),
    });

    if (!response.ok) {
      throw new Error(`OpenClaw bridge failed (${response.status}): ${raw}`);
    }

    try {
      return JSON.parse(raw);
    } catch {
      throw new Error(`OpenClaw bridge returned invalid JSON: ${raw}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}
