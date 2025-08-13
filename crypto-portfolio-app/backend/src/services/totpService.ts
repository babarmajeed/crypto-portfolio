import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

export interface TwoFactorSetup {
  secret: string;
  qrCode: string;
  backupCodes: string[];
  manualEntryKey: string;
}

export class TOTPService {
  private readonly APP_NAME = 'Crypto Portfolio';
  private readonly TOTP_WINDOW = 2; // Allow 2 steps before/after current time
  private readonly BACKUP_CODES_COUNT = 10;

  async generateSecret(userEmail: string): Promise<TwoFactorSetup> {
    // Generate TOTP secret
    const secret = speakeasy.generateSecret({
      name: `${this.APP_NAME} (${userEmail})`,
      issuer: this.APP_NAME,
      length: 32
    });

    if (!secret.otpauth_url || !secret.base32) {
      throw new Error('Failed to generate TOTP secret');
    }

    // Generate QR code
    const qrCode = await qrcode.toDataURL(secret.otpauth_url);

    // Generate backup codes
    const backupCodes = await this.generateBackupCodes();

    return {
      secret: secret.base32,
      qrCode,
      backupCodes,
      manualEntryKey: secret.base32
    };
  }

  verifyToken(secret: string, token: string): boolean {
    if (!secret || !token) {
      return false;
    }

    // Remove any whitespace from token
    const cleanToken = token.replace(/\s/g, '');

    // Verify with speakeasy
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token: cleanToken,
      window: this.TOTP_WINDOW
    });
  }

  async generateBackupCodes(): Promise<string[]> {
    const codes: string[] = [];
    
    for (let i = 0; i < this.BACKUP_CODES_COUNT; i++) {
      // Generate 8-character alphanumeric code
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      codes.push(code);
    }

    return codes;
  }

  async hashBackupCodes(codes: string[]): Promise<string[]> {
    const hashedCodes: string[] = [];
    
    for (const code of codes) {
      const hashed = await bcrypt.hash(code, 10);
      hashedCodes.push(hashed);
    }

    return hashedCodes;
  }

  async verifyBackupCode(plainCode: string, hashedCodes: string[]): Promise<{ isValid: boolean; usedIndex: number }> {
    if (!plainCode || !hashedCodes.length) {
      return { isValid: false, usedIndex: -1 };
    }

    // Remove any whitespace and convert to uppercase
    const cleanCode = plainCode.replace(/\s/g, '').toUpperCase();

    for (let i = 0; i < hashedCodes.length; i++) {
      const isMatch = await bcrypt.compare(cleanCode, hashedCodes[i]);
      if (isMatch) {
        return { isValid: true, usedIndex: i };
      }
    }

    return { isValid: false, usedIndex: -1 };
  }

  removeUsedBackupCode(hashedCodes: string[], usedIndex: number): string[] {
    if (usedIndex < 0 || usedIndex >= hashedCodes.length) {
      return hashedCodes;
    }

    const newCodes = [...hashedCodes];
    newCodes.splice(usedIndex, 1);
    return newCodes;
  }

  formatBackupCodesForDisplay(codes: string[]): string[] {
    return codes.map(code => {
      // Insert a hyphen in the middle for better readability
      return code.length === 8 
        ? `${code.substring(0, 4)}-${code.substring(4)}`
        : code;
    });
  }

  validateTOTPCode(code: string): boolean {
    if (!code) return false;
    
    // Remove any whitespace
    const cleanCode = code.replace(/\s/g, '');
    
    // TOTP codes are typically 6 digits
    return /^\d{6}$/.test(cleanCode);
  }

  validateBackupCode(code: string): boolean {
    if (!code) return false;
    
    // Remove any whitespace and hyphens
    const cleanCode = code.replace(/[\s-]/g, '').toUpperCase();
    
    // Backup codes are 8 alphanumeric characters
    return /^[A-Z0-9]{8}$/.test(cleanCode);
  }

  generateQRCodeDataURL(secret: string, userEmail: string): Promise<string> {
    const otpauthURL = speakeasy.otpauthURL({
      secret,
      encoding: 'base32',
      label: `${this.APP_NAME} (${userEmail})`,
      issuer: this.APP_NAME
    });

    return qrcode.toDataURL(otpauthURL);
  }

  // Time-based validation for rate limiting
  getRemainingTimeForNextCode(): number {
    const now = Math.floor(Date.now() / 1000);
    const timeStep = 30; // TOTP uses 30-second intervals
    const timeRemaining = timeStep - (now % timeStep);
    return timeRemaining;
  }

  // Get current time step for debugging
  getCurrentTimeStep(): number {
    return Math.floor(Date.now() / 1000 / 30);
  }
}

export const totpService = new TOTPService();