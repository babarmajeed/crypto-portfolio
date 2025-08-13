import { createHash, randomBytes, timingSafeEqual } from 'crypto';

export class CryptoUtils {
  static generateSecureRandom(length: number): Buffer {
    return randomBytes(length);
  }

  static generateSecureRandomString(length: number): string {
    return randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
  }

  static sha256Hash(input: string | Buffer): string {
    return createHash('sha256').update(input).digest('hex');
  }

  static hmacSha256(key: string | Buffer, data: string | Buffer): string {
    const hmac = require('crypto').createHmac('sha256', key);
    hmac.update(data);
    return hmac.digest('hex');
  }

  static generateUniqueId(prefix?: string): string {
    const timestamp = Date.now().toString(36);
    const randomPart = randomBytes(8).toString('hex');
    return prefix ? `${prefix}_${timestamp}_${randomPart}` : `${timestamp}_${randomPart}`;
  }

  static generateSalt(length: number = 32): Buffer {
    return randomBytes(length);
  }

  static deriveKey(password: string, salt: Buffer): Buffer {
    const crypto = require('crypto');
    return crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha512');
  }

  static isValidHex(str: string): boolean {
    return /^[0-9a-fA-F]+$/.test(str) && str.length % 2 === 0;
  }

  static generateMasterKey(): string {
    return randomBytes(32).toString('hex');
  }
}