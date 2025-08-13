import { Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { PrismaClient, UserRole } from '@prisma/client';
import { authService } from '../services/authService';
import { jwtService } from '../services/jwtService';
import { auditService } from '../services/auditService';
import { emailService } from '../services/emailService';

const prisma = new PrismaClient();

// OAuth Configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID!;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET!;
const CLIENT_URL = process.env.FRONTEND_URL!;

export class OAuthController {
  constructor() {
    this.initializePassport();
  }

  private initializePassport() {
    // Google OAuth Strategy
    passport.use(new GoogleStrategy({
      clientID: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      callbackURL: '/api/auth/google/callback',
      scope: ['profile', 'email']
    }, async (accessToken, refreshToken, profile, done) => {
      try {
        const result = await this.handleOAuthCallback({
          provider: 'google',
          providerAccountId: profile.id,
          email: profile.emails?.[0]?.value,
          firstName: profile.name?.givenName,
          lastName: profile.name?.familyName,
          accessToken,
          refreshToken,
          profileData: profile._json
        });
        
        return done(null, result);
      } catch (error) {
        return done(error, null);
      }
    }));

    // GitHub OAuth Strategy
    passport.use(new GitHubStrategy({
      clientID: GITHUB_CLIENT_ID,
      clientSecret: GITHUB_CLIENT_SECRET,
      callbackURL: '/api/auth/github/callback',
      scope: ['user:email']
    }, async (accessToken, refreshToken, profile, done) => {
      try {
        const result = await this.handleOAuthCallback({
          provider: 'github',
          providerAccountId: profile.id,
          email: profile.emails?.[0]?.value,
          firstName: profile.displayName?.split(' ')[0] || profile.username,
          lastName: profile.displayName?.split(' ').slice(1).join(' ') || '',
          accessToken,
          refreshToken,
          profileData: profile._json
        });
        
        return done(null, result);
      } catch (error) {
        return done(error, null);
      }
    }));

    passport.serializeUser((user: any, done) => {
      done(null, user);
    });

    passport.deserializeUser((user: any, done) => {
      done(null, user);
    });
  }

  private async handleOAuthCallback(data: {
    provider: string;
    providerAccountId: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    accessToken: string;
    refreshToken?: string;
    profileData: any;
  }) {
    const { provider, providerAccountId, email, firstName, lastName, accessToken, refreshToken: oauthRefreshToken } = data;

    if (!email) {
      throw new Error(`No email provided by ${provider}`);
    }

    // Check if OAuth account already exists
    const existingOAuthAccount = await prisma.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider,
          providerAccountId
        }
      },
      include: { user: true }
    });

    if (existingOAuthAccount) {
      // Update OAuth tokens
      await prisma.oAuthAccount.update({
        where: { id: existingOAuthAccount.id },
        data: {
          accessToken,
          refreshToken: oauthRefreshToken,
          expiresAt: this.getTokenExpiry(accessToken)
        }
      });

      // Return existing user
      return {
        user: existingOAuthAccount.user,
        isNewUser: false
      };
    }

    // Check if user exists with this email
    let user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (user) {
      // Link OAuth account to existing user
      await prisma.oAuthAccount.create({
        data: {
          userId: user.id,
          provider,
          providerAccountId,
          accessToken,
          refreshToken: oauthRefreshToken,
          expiresAt: this.getTokenExpiry(accessToken)
        }
      });

      return {
        user,
        isNewUser: false
      };
    }

    // Create new user with OAuth account
    user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        firstName: firstName || 'User',
        lastName: lastName || '',
        password: '', // OAuth users don't have passwords
        isEmailVerified: true, // OAuth emails are pre-verified
        role: UserRole.BASIC,
        oauthAccounts: {
          create: {
            provider,
            providerAccountId,
            accessToken,
            refreshToken: oauthRefreshToken,
            expiresAt: this.getTokenExpiry(accessToken)
          }
        }
      }
    });

    // Send welcome email for new OAuth users
    await emailService.sendWelcomeEmail(
      user.email,
      `${user.firstName} ${user.lastName}`,
      provider
    );

    return {
      user,
      isNewUser: true
    };
  }

  private getTokenExpiry(token: string): Date | null {
    // For simplicity, set expiry to 1 hour from now
    // In a real implementation, you would decode the token to get actual expiry
    return new Date(Date.now() + 60 * 60 * 1000);
  }

  // Google OAuth routes
  googleAuth = passport.authenticate('google', { 
    scope: ['profile', 'email'],
    session: false 
  });

  googleCallback = async (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate('google', { session: false }, async (err: any, result: any) => {
      if (err) {
        console.error('Google OAuth error:', err);
        return res.redirect(`${CLIENT_URL}/auth/error?message=${encodeURIComponent('OAuth authentication failed')}`);
      }

      if (!result) {
        return res.redirect(`${CLIENT_URL}/auth/error?message=${encodeURIComponent('OAuth authentication cancelled')}`);
      }

      try {
        const { user, isNewUser } = result;
        const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
        const userAgent = req.headers['user-agent'];

        // Generate JWT tokens
        const accessToken = await jwtService.generateAccessToken(user);
        const refreshTokenData = await authService.generateRefreshToken(
          user.id, 
          false, // OAuth logins don't have "remember me"
          'OAuth Login',
          ipAddress
        );

        // Create login session
        await prisma.loginSession.create({
          data: {
            userId: user.id,
            sessionId: `oauth-${Date.now()}-${Math.random()}`,
            ipAddress,
            userAgent,
            deviceInfo: 'OAuth Login',
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          }
        });

        // Update last login
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLogin: new Date() }
        });

        // Log audit event
        await auditService.log(
          'OAUTH_LOGIN',
          user.id,
          `User logged in via Google OAuth${isNewUser ? ' (new account)' : ''}`,
          ipAddress,
          userAgent
        );

        // Set refresh token cookie
        res.cookie('refreshToken', refreshTokenData.token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        // Redirect to frontend with access token
        const redirectUrl = new URL(`${CLIENT_URL}/auth/oauth/success`);
        redirectUrl.searchParams.set('token', accessToken);
        if (isNewUser) {
          redirectUrl.searchParams.set('newUser', 'true');
        }

        res.redirect(redirectUrl.toString());
      } catch (error) {
        console.error('Google OAuth callback error:', error);
        res.redirect(`${CLIENT_URL}/auth/error?message=${encodeURIComponent('Authentication processing failed')}`);
      }
    })(req, res, next);
  };

  // GitHub OAuth routes
  githubAuth = passport.authenticate('github', { 
    scope: ['user:email'],
    session: false 
  });

  githubCallback = async (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate('github', { session: false }, async (err: any, result: any) => {
      if (err) {
        console.error('GitHub OAuth error:', err);
        return res.redirect(`${CLIENT_URL}/auth/error?message=${encodeURIComponent('OAuth authentication failed')}`);
      }

      if (!result) {
        return res.redirect(`${CLIENT_URL}/auth/error?message=${encodeURIComponent('OAuth authentication cancelled')}`);
      }

      try {
        const { user, isNewUser } = result;
        const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
        const userAgent = req.headers['user-agent'];

        // Generate JWT tokens
        const accessToken = await jwtService.generateAccessToken(user);
        const refreshTokenData = await authService.generateRefreshToken(
          user.id, 
          false, 
          'OAuth Login',
          ipAddress
        );

        // Create login session
        await prisma.loginSession.create({
          data: {
            userId: user.id,
            sessionId: `oauth-${Date.now()}-${Math.random()}`,
            ipAddress,
            userAgent,
            deviceInfo: 'OAuth Login',
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          }
        });

        // Update last login
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLogin: new Date() }
        });

        // Log audit event
        await auditService.log(
          'OAUTH_LOGIN',
          user.id,
          `User logged in via GitHub OAuth${isNewUser ? ' (new account)' : ''}`,
          ipAddress,
          userAgent
        );

        // Set refresh token cookie
        res.cookie('refreshToken', refreshTokenData.token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        // Redirect to frontend with access token
        const redirectUrl = new URL(`${CLIENT_URL}/auth/oauth/success`);
        redirectUrl.searchParams.set('token', accessToken);
        if (isNewUser) {
          redirectUrl.searchParams.set('newUser', 'true');
        }

        res.redirect(redirectUrl.toString());
      } catch (error) {
        console.error('GitHub OAuth callback error:', error);
        res.redirect(`${CLIENT_URL}/auth/error?message=${encodeURIComponent('Authentication processing failed')}`);
      }
    })(req, res, next);
  };

  // Link OAuth account to existing user
  async linkOAuthAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const { provider } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      if (!['google', 'github'].includes(provider)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid OAuth provider'
        });
      }

      // Store user ID in session for OAuth callback
      req.session.linkingUserId = userId;

      // Redirect to OAuth provider
      const authUrl = provider === 'google' 
        ? '/api/auth/google'
        : '/api/auth/github';

      res.redirect(authUrl);
    } catch (error) {
      next(error);
    }
  }

  // Unlink OAuth account
  async unlinkOAuthAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const { provider } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      // Check if user has password (prevent lockout)
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { oauthAccounts: true }
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      if (!user.password && user.oauthAccounts.length === 1) {
        return res.status(400).json({
          success: false,
          message: 'Cannot unlink the only authentication method. Please set a password first.'
        });
      }

      // Remove OAuth account
      const deletedAccount = await prisma.oAuthAccount.deleteMany({
        where: {
          userId,
          provider
        }
      });

      if (deletedAccount.count === 0) {
        return res.status(404).json({
          success: false,
          message: `No ${provider} account linked to this user`
        });
      }

      // Log audit event
      await auditService.log(
        'OAUTH_ACCOUNT_UNLINKED',
        userId,
        `${provider} OAuth account unlinked`,
        req.ip,
        req.headers['user-agent']
      );

      res.status(200).json({
        success: true,
        message: `${provider} account unlinked successfully`
      });
    } catch (error) {
      next(error);
    }
  }

  // Get linked OAuth accounts
  async getLinkedAccounts(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const oauthAccounts = await prisma.oAuthAccount.findMany({
        where: { userId },
        select: {
          provider: true,
          createdAt: true,
          expiresAt: true
        }
      });

      res.status(200).json({
        success: true,
        data: {
          linkedAccounts: oauthAccounts
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

export const oauthController = new OAuthController();