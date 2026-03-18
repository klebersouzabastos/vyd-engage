import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is required for config encryption');
  }
  // Derive a 32-byte key from the env variable using SHA-256
  return crypto.createHash('sha256').update(key).digest();
}

/**
 * Encrypt a JSON-serializable value using AES-256-GCM.
 * Returns a string in format: iv:authTag:ciphertext (all hex-encoded).
 */
export function encryptConfig(data: unknown): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const plaintext = JSON.stringify(data);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt a config string encrypted with encryptConfig.
 * Returns the parsed JSON value.
 */
export function decryptConfig<T = unknown>(encryptedString: string): T {
  const key = getEncryptionKey();
  const parts = encryptedString.split(':');

  if (parts.length !== 3) {
    throw new Error('Invalid encrypted config format');
  }

  const [ivHex, authTagHex, ciphertext] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return JSON.parse(decrypted) as T;
}

/**
 * Check if a string looks like an encrypted config value.
 * Uses the iv:authTag:ciphertext format with hex-encoded parts.
 */
export function isEncrypted(value: string): boolean {
  if (typeof value !== 'string') return false;
  const parts = value.split(':');
  if (parts.length !== 3) return false;
  // Check if all parts are valid hex
  return parts.every(part => /^[0-9a-f]+$/i.test(part));
}

/**
 * Encrypt a plain string field using AES-256-GCM.
 * Returns iv:authTag:ciphertext (hex-encoded).
 * For encrypting individual fields like twoFactorSecret.
 */
export function encryptField(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt a string field encrypted with encryptField.
 * Returns the original plaintext string.
 */
export function decryptField(encryptedString: string): string {
  const key = getEncryptionKey();
  const parts = encryptedString.split(':');

  if (parts.length !== 3) {
    throw new Error('Invalid encrypted field format');
  }

  const [ivHex, authTagHex, ciphertext] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Safely encrypt a config JSON value.
 * If ENCRYPTION_KEY is not set, returns the data as-is (backwards compatibility).
 * If the data is already encrypted, returns it as-is.
 */
export function safeEncryptConfig(data: unknown): unknown {
  if (!process.env.ENCRYPTION_KEY) return data;
  if (typeof data === 'string' && isEncrypted(data)) return data;
  return encryptConfig(data);
}

/**
 * Safely decrypt a config JSON value.
 * If the value is not encrypted (backwards compatibility with plaintext data),
 * returns it as-is. Handles graceful migration from unencrypted to encrypted data.
 */
export function safeDecryptConfig<T = unknown>(value: unknown): T {
  if (typeof value === 'string' && isEncrypted(value)) {
    return decryptConfig<T>(value);
  }
  // Not encrypted — return as-is (backwards compatibility)
  return value as T;
}

/**
 * Safely encrypt a string field.
 * Returns the original value if ENCRYPTION_KEY is not set.
 */
export function safeEncryptField(plaintext: string): string {
  if (!process.env.ENCRYPTION_KEY) return plaintext;
  if (isEncrypted(plaintext)) return plaintext;
  return encryptField(plaintext);
}

/**
 * Safely decrypt a string field.
 * Returns the original value if it's not encrypted (backwards compatibility).
 */
export function safeDecryptField(value: string): string {
  if (isEncrypted(value)) {
    return decryptField(value);
  }
  return value;
}
