import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { config } from '../config.js';

const VERSION = 'v1';
const KEY_SALT = 'release-manager.settings';

let key: Buffer | null | undefined;

function getKey(): Buffer | null {
    if (key === undefined) {
        key = config.settingsEncryptionKey ? scryptSync(config.settingsEncryptionKey, KEY_SALT, 32) : null;
    }
    return key;
}

function requireKey(): Buffer {
    const secretKey = getKey();
    if (!secretKey) throw new Error('SETTINGS_ENCRYPTION_KEY is not set.');
    return secretKey;
}

export function canEncryptSecrets(): boolean {
    return getKey() !== null;
}

/** AES-256-GCM; the result is `v1.<iv>.<auth tag>.<ciphertext>` in base64url. */
export function encryptSecret(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', requireKey(), iv);
    const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return [VERSION, ...[iv, cipher.getAuthTag(), data].map((part) => part.toString('base64url'))].join('.');
}

export function decryptSecret(payload: string): string {
    const [version, iv, tag, data] = payload.split('.');
    if (version !== VERSION || !iv || !tag || data === undefined) throw new Error('Unknown secret format.');

    const decipher = createDecipheriv('aes-256-gcm', requireKey(), Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
}
