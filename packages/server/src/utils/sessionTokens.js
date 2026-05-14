/**
 * Session tokens — HMAC-signed, durable reconnect tokens.
 *
 * These tokens replace the older random-UUID + setTimeout-expiry scheme.
 *   - Stateless: no server-side map; survives process restarts.
 *   - Not single-use: the same token stays valid until it expires.
 *   - Expiry by signed timestamp, not setTimeout.
 *
 * Format: base64url(payload) + "." + base64url(hmac)
 * Payload: "<playerId>.<issuedAt>"  (issuedAt is unix ms)
 */

import crypto from 'crypto';

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

if (!process.env.SESSION_SECRET) {
  process.env.SESSION_SECRET = crypto.randomBytes(32).toString('base64url');
  console.log('[session] generated ephemeral SESSION_SECRET for this run');
}

const SECRET = process.env.SESSION_SECRET;

function hmac(payload) {
  return crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
}

/**
 * Sign a token for a player.
 * @param {string} playerId
 * @returns {string} token
 */
export function signToken(playerId) {
  if (!playerId || typeof playerId !== 'string') {
    throw new Error('signToken: playerId is required');
  }
  const issuedAt = Date.now();
  const payload = `${playerId}.${issuedAt}`;
  const sig = hmac(payload);
  const encoded = Buffer.from(payload, 'utf8').toString('base64url');
  return `${encoded}.${sig}`;
}

/**
 * Verify a token and return its claims if valid.
 * @param {string} token
 * @returns {{ playerId: string, issuedAt: number } | null}
 */
export function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;

  const dotIndex = token.lastIndexOf('.');
  if (dotIndex <= 0 || dotIndex >= token.length - 1) return null;

  const encodedPayload = token.slice(0, dotIndex);
  const sig = token.slice(dotIndex + 1);

  let payload;
  try {
    payload = Buffer.from(encodedPayload, 'base64url').toString('utf8');
  } catch {
    return null;
  }

  const expectedSig = hmac(payload);

  // timingSafeEqual requires equal-length buffers.
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

  const sep = payload.indexOf('.');
  if (sep <= 0) return null;
  const playerId = payload.slice(0, sep);
  const issuedAt = Number.parseInt(payload.slice(sep + 1), 10);
  if (!playerId || Number.isNaN(issuedAt)) return null;

  if (Date.now() - issuedAt > TOKEN_TTL_MS) return null;

  return { playerId, issuedAt };
}

export const TOKEN_TTL = TOKEN_TTL_MS;
