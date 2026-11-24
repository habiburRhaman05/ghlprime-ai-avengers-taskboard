import 'server-only';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

function key() {
  const raw = process.env.TASK_CREDENTIALS_KEY;
  if (!raw || !/^[0-9a-f]{64}$/i.test(raw)) throw new Error('TASK_CREDENTIALS_KEY must be a 32-byte hexadecimal key.');
  return Buffer.from(raw, 'hex');
}

export function encryptTaskPassword(value: string, taskId: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  cipher.setAAD(Buffer.from(taskId));
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join('.');
}

export function decryptTaskPassword(value: string, taskId: string) {
  const [version, iv, tag, data, extra] = value.split('.');
  if (version !== 'v1' || !iv || !tag || !data || extra !== undefined) throw new Error('Invalid credential.');
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
  decipher.setAAD(Buffer.from(taskId));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
}
