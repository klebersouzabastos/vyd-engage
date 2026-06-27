import crypto from 'crypto';

/**
 * Hash a token using SHA-256.
 * Used for password reset tokens, email verification tokens, and invitation tokens.
 * SHA-256 is appropriate here because tokens are already high-entropy random UUIDs,
 * so we don't need the computational cost of bcrypt/scrypt.
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Compare a plaintext token against a stored hash.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export function compareToken(token: string, storedHash: string): boolean {
  const tokenHash = hashToken(token);
  try {
    return crypto.timingSafeEqual(Buffer.from(tokenHash, 'hex'), Buffer.from(storedHash, 'hex'));
  } catch {
    return false;
  }
}
