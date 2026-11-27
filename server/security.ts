import crypto from 'node:crypto';

const SESSION_SECRET = process.env.SESSION_SECRET?.trim() || crypto.randomBytes(32).toString('hex');

export interface SessionPayload {
  role: 'applicant' | 'reviewer';
  submissionId?: string;
  exp: number;
}

export function isValidHttpUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function generateAccessCode(): string {
  const part1 = crypto.randomBytes(2).toString('hex').toUpperCase();
  const part2 = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `KEY-${part1}-${part2}`;
}

export function hashAccessCode(code: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(code.trim().toUpperCase(), salt, 32).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyAccessCode(code: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;
  const derived = crypto.scryptSync(code.trim().toUpperCase(), salt, 32);
  const expected = Buffer.from(expectedHex, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

export function signSessionToken(payload: Omit<SessionPayload, 'exp'>, ttlSeconds = 60 * 60 * 12): string {
  const fullPayload: SessionPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const encoded = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return null;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
    if (!parsed.exp || parsed.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function verifyReviewerPasscode(input: string, configuredPasscode: string): boolean {
  const a = Buffer.from(input);
  const b = Buffer.from(configuredPasscode);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function generateShareToken(): string {
  return crypto.randomBytes(18).toString('base64url');
}
