import { createHash, randomBytes } from 'node:crypto';

export function hashRefreshToken(raw: string): string {
  return createHash('sha256').update(raw, 'utf8').digest('hex');
}

export function generateRefreshTokenRaw(): string {
  return randomBytes(32).toString('base64url');
}
