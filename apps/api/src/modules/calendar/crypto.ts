import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

/**
 * AES-256-GCM helpers for encrypting OAuth/CalDAV tokens at rest (Task 5.4).
 * Key is derived from CALENDAR_ENC_KEY (or AUTH_SECRET) — set a strong value in
 * production. Format: base64(iv).base64(tag).base64(ciphertext).
 */
const KEY = scryptSync(process.env.CALENDAR_ENC_KEY ?? process.env.AUTH_SECRET ?? 'dev-only-insecure-key', 'dokane-calendar', 32);

export function encryptToken(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join('.');
}

export function decryptToken(blob: string): string {
  const parts = blob.split('.');
  const iv = Buffer.from(parts[0] ?? '', 'base64');
  const tag = Buffer.from(parts[1] ?? '', 'base64');
  const enc = Buffer.from(parts[2] ?? '', 'base64');
  const decipher = createDecipheriv('aes-256-gcm', KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}
