import { PrismaClient, User } from '@prisma/client';
import { authService } from './authService';
import { auditService } from './auditService';
import { emailService } from './emailService';

const prisma = new PrismaClient();

interface OAuthProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  emailVerified?: boolean;
}

interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  tokenType?: string;
  scope?: string;
  idToken?: string;
}

class OAuthService {
  async handleOAuthCallback(
    provider: string,
    profile: OAuthProfile,
    tokens: OAuthTokens,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ user: Omit<User, 'password' | 'twoFactorSecret'>; tokens: { accessToken: string; refreshToken: string }; isNewUser: boolean }> {
    
    let user: User | null = null;
    let isNewUser = false;

    // Check if OAuth account already exists
    const existingOAuthAccount = await prisma.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider,
          providerAccountId: profile.id
        }
      },
      include: { user: true }
    });

    if (existingOAuthAccount) {
      // Existing OAuth account - update tokens and login
      await this.updateOAuthTokens(existingOAuthAccount.id, tokens);
      user = existingOAuthAccount.user;
    } else {
      // Check if user exists with same email
      const existingUser = await prisma.user.findUnique({
        where: { email: profile.email.toLowerCase() }
      });

      if (existingUser) {
        // Link OAuth account to existing user
        user = existingUser;
        await this.createOAuthAccount(user.id, provider, profile, tokens);
        
        // Log account linking
        await auditService.log({
          userId: user.id,
          action: 'OAUTH_ACCOUNT_LINKED',
          resource: 'OAuthAccount',
          details: { provider, accountId: profile.id },
          ipAddress,
          userAgent
        });
      } else {
        // Create new user with OAuth account
        isNewUser = true;
        user = await this.createUserWithOAuth(provider, profile, tokens);
        
        // Send welcome email
        await emailService.sendWelcomeEmail(user.email, user.firstName);
      }
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    });

    // Generate JWT tokens
    const jwtTokens = await this.generateJWTTokens(user, ipAddress, userAgent);

    // Log OAuth login
    await auditService.log({
      userId: user.id,
      action: 'OAUTH_LOGIN',
      resource: 'User',
      details: { provider, isNewUser },
      ipAddress,
      userAgent
    });

    return {
      user: this.sanitizeUser(user),
      tokens: jwtTokens,
      isNewUser
    };
  }

  async unlinkOAuthAccount(userId: string, provider: string, ipAddress?: string, userAgent?: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { oauthAccounts: true }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Check if user has a password or other OAuth accounts
    const hasPassword = !!user.password;
    const otherOAuthAccounts = user.oauthAccounts.filter(account => account.provider !== provider);
    
    if (!hasPassword && otherOAuthAccounts.length === 0) {
      throw new Error('Cannot unlink the only authentication method. Please set a password first.');
    }

    // Delete OAuth account
    const deletedAccount = await prisma.oAuthAccount.deleteMany({
      where: {
        userId,
        provider
      }
    });

    if (deletedAccount.count === 0) {
      throw new Error('OAuth account not found');
    }

    // Log account unlinking
    await auditService.log({
      userId,
      action: 'OAUTH_ACCOUNT_UNLINKED',
      resource: 'OAuthAccount',
      details: { provider },
      ipAddress,
      userAgent
    });
  }

  async getLinkedOAuthAccounts(userId: string): Promise<Array<{ provider: string; linkedAt: Date }>> {
    const accounts = await prisma.oAuthAccount.findMany({
      where: { userId },
      select: {
        provider: true,
        createdAt: true
      }
    });

    return accounts.map(account => ({
      provider: account.provider,
      linkedAt: account.createdAt
    }));
  }

  async refreshOAuthToken(userId: string, provider: string): Promise<void> {
    const oauthAccount = await prisma.oAuthAccount.findFirst({
      where: { userId, provider }
    });

    if (!oauthAccount || !oauthAccount.refreshToken) {
      throw new Error('OAuth account or refresh token not found');
    }

    try {
      // Implement provider-specific token refresh logic
      let newTokens: OAuthTokens;

      switch (provider) {
        case 'google':
          newTokens = await this.refreshGoogleToken(oauthAccount.refreshToken);
          break;
        case 'github':
          // GitHub tokens don't expire, so we don't need to refresh
          return;
        default:
          throw new Error(`Token refresh not implemented for provider: ${provider}`);
      }

      await this.updateOAuthTokens(oauthAccount.id, newTokens);
    } catch (error) {
      console.error(`Failed to refresh OAuth token for ${provider}:`, error);
      throw new Error('Failed to refresh OAuth token');
    }
  }

  private async createUserWithOAuth(provider: string, profile: OAuthProfile, tokens: OAuthTokens): Promise<User> {
    return prisma.$transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          email: profile.email.toLowerCase(),
          firstName: profile.firstName,
          lastName: profile.lastName,
          password: '', // OAuth users don't have passwords initially
          isEmailVerified: profile.emailVerified || provider === 'google', // Trust Google's email verification
          role: 'BASIC'
        }
      });

      // Create OAuth account
      await tx.oAuthAccount.create({
        data: {
          userId: user.id,
          provider,
          providerAccountId: profile.id,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt,
          tokenType: tokens.tokenType,
          scope: tokens.scope,
          idToken: tokens.idToken
        }
      });

      return user;
    });
  }

  private async createOAuthAccount(userId: string, provider: string, profile: OAuthProfile, tokens: OAuthTokens): Promise<void> {
    await prisma.oAuthAccount.create({
      data: {
        userId,
        provider,
        providerAccountId: profile.id,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        tokenType: tokens.tokenType,
        scope: tokens.scope,
        idToken: tokens.idToken
      }
    });
  }

  private async updateOAuthTokens(oauthAccountId: string, tokens: OAuthTokens): Promise<void> {
    await prisma.oAuthAccount.update({
      where: { id: oauthAccountId },
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        tokenType: tokens.tokenType,
        scope: tokens.scope,
        idToken: tokens.idToken,
        updatedAt: new Date()
      }
    });
  }

  private async generateJWTTokens(user: User, ipAddress?: string, userAgent?: string): Promise<{ accessToken: string; refreshToken: string }> {
    // Use the existing auth service to generate tokens
    const authServiceInstance = new (authService.constructor as any)();
    return authServiceInstance.generateTokenPair(user, undefined, ipAddress);
  }

  private async refreshGoogleToken(refreshToken: string): Promise<OAuthTokens> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      })
    });

    if (!response.ok) {
      throw new Error('Failed to refresh Google token');
    }

    const data = await response.json();
    
    return {
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      tokenType: data.token_type,
      scope: data.scope
    };
  }

  private sanitizeUser(user: User): Omit<User, 'password' | 'twoFactorSecret'> {
    const { password, twoFactorSecret, ...sanitizedUser } = user;
    return sanitizedUser;
  }

  // Provider-specific profile parsers
  static parseGoogleProfile(googleUser: any): OAuthProfile {
    return {
      id: googleUser.id,
      email: googleUser.email,
      firstName: googleUser.given_name || '',
      lastName: googleUser.family_name || '',
      avatar: googleUser.picture,
      emailVerified: googleUser.email_verified
    };
  }

  static parseGitHubProfile(githubUser: any): OAuthProfile {
    const [firstName = '', lastName = ''] = (githubUser.name || '').split(' ');
    
    return {
      id: githubUser.id.toString(),
      email: githubUser.email,
      firstName,
      lastName,
      avatar: githubUser.avatar_url,
      emailVerified: true // GitHub requires verified emails for OAuth
    };
  }
}

export const oauthService = new OAuthService();