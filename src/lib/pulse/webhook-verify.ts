import crypto from 'node:crypto';

const MAX_AGE_SECONDS = 5 * 60;

/**
 * Verify an HMAC-SHA256 signature from a Pulse webhook request.
 *
 * Pulse signs `${timestamp}.${raw_body}` with PULSE_WEBHOOK_SECRET and sends
 * the hex digest in `x-pulse-signature`. The timestamp (seconds-since-epoch)
 * lives in `x-pulse-timestamp` and is checked to bound replay attacks.
 */
export function verifyPulseSignature({
  rawBody,
  signature,
  timestamp,
  secret,
}: {
  rawBody: string;
  signature: string | null;
  timestamp: string | null;
  secret: string;
}): { ok: true } | { ok: false; reason: string } {
  if (!signature || !timestamp) {
    return { ok: false, reason: 'Missing signature or timestamp header' };
  }

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) {
    return { ok: false, reason: 'Invalid timestamp' };
  }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > MAX_AGE_SECONDS) {
    return { ok: false, reason: 'Timestamp outside allowed window' };
  }

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');

  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(signature, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: 'Signature mismatch' };
  }

  return { ok: true };
}
