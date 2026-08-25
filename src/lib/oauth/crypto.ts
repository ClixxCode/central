import crypto from 'crypto';
import { hash as hashPassword, compare as comparePassword } from 'bcryptjs';

export function randomOpaqueToken(prefix: string): string {
  return `${prefix}${crypto.randomBytes(32).toString('base64url')}`;
}

export function digestToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function base64UrlSha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('base64url');
}

export function verifyPkce(verifier: string, challenge: string): boolean {
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) return false;
  const actual = Buffer.from(base64UrlSha256(verifier));
  const expected = Buffer.from(challenge);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

export async function hashClientSecret(secret: string): Promise<string> {
  return hashPassword(secret, 12);
}

export async function verifyClientSecret(secret: string, hash: string): Promise<boolean> {
  return comparePassword(secret, hash);
}

function transactionSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET is required for OAuth transactions');
  return secret;
}

export function signTransaction(payload: Record<string, unknown>): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', transactionSecret())
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${signature}`;
}

export function verifyTransaction<T>(value: string | undefined): T | null {
  if (!value) return null;
  const [encoded, signature, extra] = value.split('.');
  if (!encoded || !signature || extra) return null;
  const expected = crypto
    .createHmac('sha256', transactionSecret())
    .update(encoded)
    .digest('base64url');
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return null;
  try {
    return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as T;
  } catch {
    return null;
  }
}
