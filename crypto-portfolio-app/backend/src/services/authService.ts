import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { PrismaClient, User, UserRole } from '@prisma/client';
import { sendEmail } from './emailService';
import { auditService } from './auditService';
import { rateLimitService } from './rateLimitService';

const prisma = new PrismaClient();

interface LoginCredentials {
  email: string;
  password: string;
  twoFactorToken?: string;
  deviceInfo?: string;
  ipAddress?: string;
  userAgent?: string;
}

interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  ipAddress?: string;
  userAgent?: string;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface AuthResult {
  user: Omit<User, 'password' | 'twoFactorSecret'>;
  tokens: TokenPair;
  requiresTwoFactor?: boolean;
  tempToken?: string;
}

export class AuthService {
  private readonly JWT_SECRET = process.env.JWT_SECRET!;
  private readonly JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;
  private readonly JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
  private readonly JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
  private readonly BCRYPT_ROUNDS = 12;
  private readonly MAX_LOGIN_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

  async register(data: RegisterData): Promise<{ user: Omit<User, 'password' | 'twoFactorSecret'>; verificationToken: string }> {
    const { email, password, firstName, lastName, ipAddress, userAgent } = data;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (existingUser) {
      throw new Error('User already exists');
    }

    // Validate password strength
    this.validatePassword(password);

    // Hash password
    const hashedPassword = await bcrypt.hash(password, this.BCRYPT_ROUNDS);

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create user
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        firstName,
        lastName,
        emailVerificationToken: verificationToken,
        emailVerificationExpires: verificationExpires
      }
    });

    // Log audit event
    await auditService.log({
      userId: user.id,
      action: 'USER_REGISTERED',
      resource: 'User',
      details: { email: user.email },
      ipAddress,
      userAgent
    });

    // Send verification email
    await sendEmail({
      to: user.email,
      subject: 'Verify Your Email - Crypto Portfolio',
      template: 'email-verification',
      data: {
        firstName: user.firstName,
        verificationToken,
        verificationUrl: `${process.env.FRONTEND_URL}/auth/verify-email?token=${verificationToken}`
      }
    });

    const { password: _, twoFactorSecret: __, ...userWithoutSensitiveData } = user;
    return { user: userWithoutSensitiveData, verificationToken };
  }

  async login(credentials: LoginCredentials): Promise<AuthResult> {
    const { email, password, twoFactorToken, deviceInfo, ipAddress, userAgent } = credentials;

    // Check rate limiting
    await rateLimitService.checkLoginRate(ipAddress || 'unknown');

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!user) {
      await rateLimitService.recordFailedLogin(ipAddress || 'unknown');
      throw new Error('Invalid credentials');
    }

    // Check if account is locked
    if (user.accountLockedUntil && user.accountLockedUntil > new Date()) {
      const lockTimeRemaining = Math.ceil((user.accountLockedUntil.getTime() - Date.now()) / 1000 / 60);
      throw new Error(`Account locked. Try again in ${lockTimeRemaining} minutes`);
    }

    // Check if account is active
    if (!user.isActive) {
      throw new Error('Account is deactivated');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      await this.handleFailedLogin(user, ipAddress, userAgent);
      throw new Error('Invalid credentials');
    }

    // Check email verification
    if (!user.isEmailVerified) {
      throw new Error('Email not verified. Please check your email for verification link');
    }

    // Handle two-factor authentication
    if (user.isTwoFactorEnabled) {
      if (!twoFactorToken) {
        // Generate temporary token for 2FA step
        const tempToken = this.generateTempToken(user.id);
        return {
          user: this.sanitizeUser(user),
          tokens: { accessToken: '', refreshToken: '' },
          requiresTwoFactor: true,
          tempToken
        };
      }

      // Verify 2FA token
      const is2FAValid = this.verifyTwoFactorToken(user.twoFactorSecret!, twoFactorToken);
      if (!is2FAValid) {
        await this.handleFailedLogin(user, ipAddress, userAgent);
        throw new Error('Invalid two-factor authentication code');
      }
    }

    // Reset failed login attempts
    await this.resetFailedLoginAttempts(user.id);

    // Generate tokens
    const tokens = await this.generateTokenPair(user, deviceInfo, ipAddress);

    // Create login session
    await this.createLoginSession(user.id, tokens.refreshToken, ipAddress, userAgent, deviceInfo);

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    });

    // Log audit event
    await auditService.log({
      userId: user.id,
      action: 'USER_LOGIN',
      resource: 'User',
      details: { twoFactorUsed: user.isTwoFactorEnabled },
      ipAddress,
      userAgent
    });

    return {
      user: this.sanitizeUser(user),
      tokens
    };
  }

  async completeTwoFactorLogin(tempToken: string, twoFactorToken: string, deviceInfo?: string, ipAddress?: string, userAgent?: string): Promise<AuthResult> {
    // Verify temp token
    const decoded = jwt.verify(tempToken, this.JWT_SECRET) as { userId: string; type: string };
    if (decoded.type !== 'temp_2fa') {
      throw new Error('Invalid temporary token');
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });

    if (!user || !user.isTwoFactorEnabled) {
      throw new Error('Invalid request');
    }

    // Verify 2FA token
    const is2FAValid = this.verifyTwoFactorToken(user.twoFactorSecret!, twoFactorToken);
    if (!is2FAValid) {
      await this.handleFailedLogin(user, ipAddress, userAgent);
      throw new Error('Invalid two-factor authentication code');
    }

    // Generate tokens
    const tokens = await this.generateTokenPair(user, deviceInfo, ipAddress);

    // Create login session
    await this.createLoginSession(user.id, tokens.refreshToken, ipAddress, userAgent, deviceInfo);

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    });

    // Log audit event
    await auditService.log({
      userId: user.id,
      action: 'TWO_FACTOR_LOGIN_COMPLETED',
      resource: 'User',
      ipAddress,
      userAgent
    });

    return {
      user: this.sanitizeUser(user),
      tokens
    };
  }

  async refreshToken(refreshToken: string, ipAddress?: string, userAgent?: string): Promise<TokenPair> {
    // Verify refresh token
    const decoded = jwt.verify(refreshToken, this.JWT_REFRESH_SECRET) as { userId: string; tokenId: string };

    // Check if refresh token exists and is valid
    const tokenRecord = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true }
    });

    if (!tokenRecord || tokenRecord.isRevoked || tokenRecord.expiresAt < new Date()) {
      throw new Error('Invalid refresh token');
    }

    // Generate new token pair
    const newTokens = await this.generateTokenPair(tokenRecord.user, tokenRecord.deviceInfo, ipAddress);

    // Revoke old refresh token
    await prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: { isRevoked: true }
    });

    // Log audit event
    await auditService.log({
      userId: tokenRecord.userId,
      action: 'TOKEN_REFRESHED',
      resource: 'RefreshToken',
      ipAddress,
      userAgent
    });

    return newTokens;
  }

  async logout(refreshToken: string, ipAddress?: string, userAgent?: string): Promise<void> {
    try {
      const decoded = jwt.verify(refreshToken, this.JWT_REFRESH_SECRET) as { userId: string; tokenId: string };

      // Revoke refresh token
      await prisma.refreshToken.updateMany({
        where: { token: refreshToken },
        data: { isRevoked: true }
      });

      // End login session
      await prisma.loginSession.updateMany({
        where: { 
          userId: decoded.userId,
          isActive: true 
        },
        data: { 
          isActive: false,
          logoutAt: new Date()
        }
      });

      // Log audit event
      await auditService.log({
        userId: decoded.userId,
        action: 'USER_LOGOUT',
        resource: 'User',
        ipAddress,
        userAgent
      });
    } catch (error) {
      // Token might be invalid, but still log the logout attempt
      await auditService.log({
        action: 'LOGOUT_ATTEMPT',
        resource: 'User',
        details: { error: 'Invalid token' },
        ipAddress,
        userAgent
      });
    }
  }

  async verifyEmail(token: string): Promise<void> {
    const user = await prisma.user.findFirst({
      where: {
        emailVerificationToken: token,
        emailVerificationExpires: {
          gt: new Date()
        }
      }
    });

    if (!user) {
      throw new Error('Invalid or expired verification token');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null
      }
    });

    // Log audit event
    await auditService.log({
      userId: user.id,
      action: 'EMAIL_VERIFIED',
      resource: 'User'
    });
  }

  async requestPasswordReset(email: string, ipAddress?: string, userAgent?: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!user) {
      // Don't reveal if email exists
      return;
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires
      }
    });

    // Send reset email
    await sendEmail({
      to: user.email,
      subject: 'Password Reset - Crypto Portfolio',
      template: 'password-reset',
      data: {
        firstName: user.firstName,
        resetToken,
        resetUrl: `${process.env.FRONTEND_URL}/auth/reset-password?token=${resetToken}`
      }
    });

    // Log audit event
    await auditService.log({
      userId: user.id,
      action: 'PASSWORD_RESET_REQUESTED',
      resource: 'User',
      ipAddress,
      userAgent
    });
  }

  async resetPassword(token: string, newPassword: string, ipAddress?: string, userAgent?: string): Promise<void> {
    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpires: {
          gt: new Date()
        }
      }
    });

    if (!user) {
      throw new Error('Invalid or expired reset token');
    }

    // Validate password strength
    this.validatePassword(newPassword);

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, this.BCRYPT_ROUNDS);

    // Update user
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
        failedLoginAttempts: 0,
        accountLockedUntil: null
      }
    });

    // Revoke all refresh tokens
    await prisma.refreshToken.updateMany({
      where: { userId: user.id },
      data: { isRevoked: true }
    });

    // End all login sessions
    await prisma.loginSession.updateMany({
      where: { userId: user.id, isActive: true },
      data: { isActive: false, logoutAt: new Date() }
    });

    // Log audit event
    await auditService.log({
      userId: user.id,
      action: 'PASSWORD_RESET_COMPLETED',
      resource: 'User',
      ipAddress,
      userAgent
    });

    // Send confirmation email
    await sendEmail({
      to: user.email,
      subject: 'Password Changed - Crypto Portfolio',
      template: 'password-changed',
      data: {
        firstName: user.firstName,
        changeTime: new Date().toISOString()
      }
    });
  }

  async setupTwoFactor(userId: string): Promise<{ secret: string; qrCodeUrl: string; backupCodes: string[] }> {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (user.isTwoFactorEnabled) {
      throw new Error('Two-factor authentication is already enabled');
    }

    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `Crypto Portfolio (${user.email})`,
      issuer: 'Crypto Portfolio'
    });

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);

    // Generate backup codes
    const backupCodes = Array.from({ length: 10 }, () => 
      crypto.randomBytes(4).toString('hex').toUpperCase()
    );

    // Store secret temporarily (not enabled until verified)
    await prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorSecret: secret.base32,
        backupCodes
      }
    });

    return {
      secret: secret.base32!,
      qrCodeUrl,
      backupCodes
    };
  }

  async enableTwoFactor(userId: string, token: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user || !user.twoFactorSecret) {
      throw new Error('Two-factor setup not initiated');
    }

    // Verify token
    const isValid = this.verifyTwoFactorToken(user.twoFactorSecret, token);
    if (!isValid) {
      throw new Error('Invalid verification code');
    }

    // Enable 2FA
    await prisma.user.update({
      where: { id: userId },
      data: { isTwoFactorEnabled: true }
    });

    // Log audit event
    await auditService.log({
      userId,
      action: 'TWO_FACTOR_ENABLED',
      resource: 'User'
    });
  }

  async disableTwoFactor(userId: string, password: string, token?: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new Error('Invalid password');
    }

    // If 2FA is enabled, require token
    if (user.isTwoFactorEnabled) {
      if (!token) {
        throw new Error('Two-factor authentication code required');
      }

      const isTokenValid = this.verifyTwoFactorToken(user.twoFactorSecret!, token);
      if (!isTokenValid) {
        throw new Error('Invalid two-factor authentication code');
      }
    }

    // Disable 2FA
    await prisma.user.update({
      where: { id: userId },
      data: {
        isTwoFactorEnabled: false,
        twoFactorSecret: null,
        backupCodes: []
      }
    });

    // Log audit event
    await auditService.log({
      userId,
      action: 'TWO_FACTOR_DISABLED',
      resource: 'User'
    });
  }

  private async generateTokenPair(user: User, deviceInfo?: string, ipAddress?: string): Promise<TokenPair> {
    // Generate access token
    const accessToken = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role
      },
      this.JWT_SECRET,
      { expiresIn: this.JWT_EXPIRES_IN }
    );

    // Generate refresh token
    const refreshTokenData = {
      userId: user.id,
      tokenId: crypto.randomUUID()
    };

    const refreshToken = jwt.sign(
      refreshTokenData,
      this.JWT_REFRESH_SECRET,
      { expiresIn: this.JWT_REFRESH_EXPIRES_IN }
    );

    // Store refresh token
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        deviceInfo,
        ipAddress
      }
    });

    return { accessToken, refreshToken };
  }

  private generateTempToken(userId: string): string {
    return jwt.sign(
      { userId, type: 'temp_2fa' },
      this.JWT_SECRET,
      { expiresIn: '10m' }
    );
  }

  private verifyTwoFactorToken(secret: string, token: string): boolean {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 2 // Allow 2 steps before/after for time drift
    });
  }

  private async handleFailedLogin(user: User, ipAddress?: string, userAgent?: string): Promise<void> {
    const failedAttempts = user.failedLoginAttempts + 1;
    const updateData: any = { failedLoginAttempts: failedAttempts };

    if (failedAttempts >= this.MAX_LOGIN_ATTEMPTS) {
      updateData.accountLockedUntil = new Date(Date.now() + this.LOCKOUT_DURATION);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: updateData
    });

    // Record failed login for rate limiting
    await rateLimitService.recordFailedLogin(ipAddress || 'unknown');

    // Log audit event
    await auditService.log({
      userId: user.id,
      action: 'FAILED_LOGIN_ATTEMPT',
      resource: 'User',
      details: { 
        failedAttempts,
        accountLocked: failedAttempts >= this.MAX_LOGIN_ATTEMPTS
      },
      ipAddress,
      userAgent
    });
  }

  private async resetFailedLoginAttempts(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: 0,
        accountLockedUntil: null
      }
    });
  }

  private async createLoginSession(userId: string, refreshToken: string, ipAddress?: string, userAgent?: string, deviceInfo?: string): Promise<void> {
    const sessionId = crypto.randomUUID();
    
    await prisma.loginSession.create({
      data: {
        userId,
        sessionId,
        ipAddress: ipAddress || 'unknown',
        userAgent,
        deviceInfo,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      }
    });
  }

  private validatePassword(password: string): void {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (password.length < minLength) {
      throw new Error(`Password must be at least ${minLength} characters long`);
    }

    if (!hasUpperCase) {
      throw new Error('Password must contain at least one uppercase letter');
    }

    if (!hasLowerCase) {
      throw new Error('Password must contain at least one lowercase letter');
    }

    if (!hasNumbers) {
      throw new Error('Password must contain at least one number');
    }

    if (!hasSpecialChar) {
      throw new Error('Password must contain at least one special character');
    }
  }

  private sanitizeUser(user: User): Omit<User, 'password' | 'twoFactorSecret'> {
    const { password, twoFactorSecret, ...sanitizedUser } = user;
    return sanitizedUser;
  }
}

export const authService = new AuthService();