# Authentication Service Architecture

## Overview
Comprehensive authentication and authorization service supporting JWT tokens, OAuth2 providers, two-factor authentication, and role-based access control.

## Authentication Architecture

### Service Design

```
┌─────────────────────────────────────────────────────────────┐
│                    API Gateway                             │
│              (Auth Middleware)                             │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                Authentication Service                      │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │    JWT      │  │   OAuth2    │  │     2FA     │        │
│  │  Handler    │  │   Provider  │  │   Manager   │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Session   │  │    RBAC     │  │   Password  │        │
│  │  Manager    │  │   Engine    │  │  Validator  │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    User Database                           │
│              (PostgreSQL + Redis)                          │
└─────────────────────────────────────────────────────────────┘
```

### Core Authentication Service Implementation

```typescript
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import speakeasy from 'speakeasy';
import { Redis } from 'ioredis';
import { OAuth2Client } from 'google-auth-library';

interface User {
  id: string;
  email: string;
  passwordHash: string;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
  roles: string[];
  lastLogin?: Date;
  loginAttempts: number;
  lockoutUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

interface LoginRequest {
  email: string;
  password: string;
  twoFactorCode?: string;
  rememberMe?: boolean;
}

interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

class AuthenticationService {
  private redis: Redis;
  private jwtSecret: string;
  private jwtRefreshSecret: string;
  private googleClient: OAuth2Client;
  
  // Security configurations
  private readonly MAX_LOGIN_ATTEMPTS = 5;
  private readonly LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes
  private readonly ACCESS_TOKEN_EXPIRY = '15m';
  private readonly REFRESH_TOKEN_EXPIRY = '7d';
  private readonly PASSWORD_MIN_LENGTH = 8;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL!);
    this.jwtSecret = process.env.JWT_SECRET!;
    this.jwtRefreshSecret = process.env.JWT_REFRESH_SECRET!;
    this.googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID!);
  }

  async register(request: RegisterRequest): Promise<{ user: Partial<User>; tokens: AuthTokens }> {
    // Validate password strength
    this.validatePassword(request.password);

    // Check if user already exists
    const existingUser = await this.getUserByEmail(request.email);
    if (existingUser) {
      throw new Error('User already exists');
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(request.password, saltRounds);

    // Create user
    const user: User = {
      id: this.generateUserId(),
      email: request.email.toLowerCase(),
      passwordHash,
      emailVerified: false,
      twoFactorEnabled: false,
      roles: ['user'],
      loginAttempts: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Save to database
    await this.saveUser(user);

    // Send verification email
    await this.sendEmailVerification(user.email);

    // Generate tokens
    const tokens = await this.generateTokens(user);

    // Log registration event
    await this.logAuthEvent('user_registered', user.id, {
      email: user.email,
      timestamp: new Date().toISOString()
    });

    return {
      user: this.sanitizeUser(user),
      tokens
    };
  }

  async login(request: LoginRequest): Promise<{ user: Partial<User>; tokens: AuthTokens }> {
    const { email, password, twoFactorCode, rememberMe } = request;

    // Get user by email
    const user = await this.getUserByEmail(email.toLowerCase());
    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Check if account is locked
    if (this.isAccountLocked(user)) {
      throw new Error('Account temporarily locked due to too many failed attempts');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      await this.handleFailedLogin(user);
      throw new Error('Invalid credentials');
    }

    // Check 2FA if enabled
    if (user.twoFactorEnabled) {
      if (!twoFactorCode) {
        throw new Error('Two-factor authentication code required');
      }

      const is2FAValid = this.verify2FA(user.twoFactorSecret!, twoFactorCode);
      if (!is2FAValid) {
        await this.handleFailedLogin(user);
        throw new Error('Invalid two-factor authentication code');
      }
    }

    // Check email verification
    if (!user.emailVerified) {
      throw new Error('Email not verified. Please check your email for verification link.');
    }

    // Reset login attempts and update last login
    await this.resetLoginAttempts(user);
    await this.updateLastLogin(user);

    // Generate tokens
    const tokenExpiry = rememberMe ? '30d' : this.REFRESH_TOKEN_EXPIRY;
    const tokens = await this.generateTokens(user, tokenExpiry);

    // Log successful login
    await this.logAuthEvent('user_login', user.id, {
      email: user.email,
      timestamp: new Date().toISOString(),
      rememberMe: !!rememberMe
    });

    return {
      user: this.sanitizeUser(user),
      tokens
    };
  }

  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    try {
      const decoded = jwt.verify(refreshToken, this.jwtRefreshSecret) as any;
      
      // Check if refresh token is blacklisted
      const isBlacklisted = await this.redis.get(`blacklist:${refreshToken}`);
      if (isBlacklisted) {
        throw new Error('Token has been revoked');
      }

      // Get user
      const user = await this.getUserById(decoded.userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Generate new tokens
      const tokens = await this.generateTokens(user);

      // Blacklist old refresh token
      await this.blacklistToken(refreshToken);

      return tokens;
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  async logout(refreshToken: string): Promise<void> {
    // Blacklist refresh token
    await this.blacklistToken(refreshToken);

    // Log logout event
    try {
      const decoded = jwt.verify(refreshToken, this.jwtRefreshSecret) as any;
      await this.logAuthEvent('user_logout', decoded.userId, {
        timestamp: new Date().toISOString()
      });
    } catch {
      // Token might be invalid, but still proceed with logout
    }
  }

  async verifyAccessToken(token: string): Promise<{ userId: string; roles: string[] }> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as any;
      
      // Check if token is blacklisted
      const isBlacklisted = await this.redis.get(`blacklist:${token}`);
      if (isBlacklisted) {
        throw new Error('Token has been revoked');
      }

      return {
        userId: decoded.userId,
        roles: decoded.roles
      };
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  async setup2FA(userId: string): Promise<{ secret: string; qrCode: string }> {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Generate 2FA secret
    const secret = speakeasy.generateSecret({
      name: `Crypto Portfolio (${user.email})`,
      issuer: 'Crypto Portfolio App',
      length: 32
    });

    // Store temporary secret (not enabled until verified)
    await this.redis.setex(`2fa_setup:${userId}`, 300, secret.base32); // 5 minutes

    return {
      secret: secret.base32,
      qrCode: secret.otpauth_url!
    };
  }

  async enable2FA(userId: string, token: string): Promise<void> {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Get temporary secret
    const tempSecret = await this.redis.get(`2fa_setup:${userId}`);
    if (!tempSecret) {
      throw new Error('2FA setup session expired');
    }

    // Verify token
    const isValid = this.verify2FA(tempSecret, token);
    if (!isValid) {
      throw new Error('Invalid 2FA code');
    }

    // Enable 2FA for user
    await this.update2FA(userId, tempSecret, true);

    // Clean up temporary secret
    await this.redis.del(`2fa_setup:${userId}`);

    // Log 2FA enable event
    await this.logAuthEvent('2fa_enabled', userId, {
      timestamp: new Date().toISOString()
    });
  }

  async disable2FA(userId: string, password: string): Promise<void> {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new Error('Invalid password');
    }

    // Disable 2FA
    await this.update2FA(userId, null, false);

    // Log 2FA disable event
    await this.logAuthEvent('2fa_disabled', userId, {
      timestamp: new Date().toISOString()
    });
  }

  private async generateTokens(user: User, refreshExpiry?: string): Promise<AuthTokens> {
    const payload = {
      userId: user.id,
      email: user.email,
      roles: user.roles,
      emailVerified: user.emailVerified
    };

    const accessToken = jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.ACCESS_TOKEN_EXPIRY,
      issuer: 'crypto-portfolio-auth',
      audience: 'crypto-portfolio-api'
    });

    const refreshToken = jwt.sign(
      { userId: user.id },
      this.jwtRefreshSecret,
      {
        expiresIn: refreshExpiry || this.REFRESH_TOKEN_EXPIRY,
        issuer: 'crypto-portfolio-auth',
        audience: 'crypto-portfolio-api'
      }
    );

    // Store refresh token in Redis
    const refreshExpireTime = refreshExpiry === '30d' ? 30 * 24 * 60 * 60 : 7 * 24 * 60 * 60;
    await this.redis.setex(`refresh_token:${user.id}`, refreshExpireTime, refreshToken);

    return {
      accessToken,
      refreshToken,
      expiresIn: 15 * 60, // 15 minutes in seconds
      tokenType: 'Bearer'
    };
  }

  private verify2FA(secret: string, token: string): boolean {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 1
    });
  }

  private validatePassword(password: string): void {
    if (password.length < this.PASSWORD_MIN_LENGTH) {
      throw new Error(`Password must be at least ${this.PASSWORD_MIN_LENGTH} characters long`);
    }

    // Check for at least one uppercase, lowercase, number, and special character
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;
    if (!passwordRegex.test(password)) {
      throw new Error('Password must contain at least one uppercase letter, lowercase letter, number, and special character');
    }
  }

  private isAccountLocked(user: User): boolean {
    return user.lockoutUntil ? user.lockoutUntil > new Date() : false;
  }

  private async handleFailedLogin(user: User): Promise<void> {
    const attempts = user.loginAttempts + 1;
    
    if (attempts >= this.MAX_LOGIN_ATTEMPTS) {
      const lockoutUntil = new Date(Date.now() + this.LOCKOUT_TIME);
      await this.updateLoginAttempts(user.id, attempts, lockoutUntil);
    } else {
      await this.updateLoginAttempts(user.id, attempts);
    }
  }

  private async blacklistToken(token: string): Promise<void> {
    try {
      const decoded = jwt.decode(token) as any;
      if (decoded && decoded.exp) {
        const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);
        if (expiresIn > 0) {
          await this.redis.setex(`blacklist:${token}`, expiresIn, '1');
        }
      }
    } catch {
      // If decoding fails, blacklist for a default time
      await this.redis.setex(`blacklist:${token}`, 24 * 60 * 60, '1'); // 24 hours
    }
  }

  private sanitizeUser(user: User): Partial<User> {
    const { passwordHash, twoFactorSecret, ...sanitized } = user;
    return sanitized;
  }

  private generateUserId(): string {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Database operations (these would be implemented with your chosen ORM/database client)
  private async getUserByEmail(email: string): Promise<User | null> {
    // Implementation depends on your database choice
    throw new Error('Not implemented');
  }

  private async getUserById(id: string): Promise<User | null> {
    // Implementation depends on your database choice
    throw new Error('Not implemented');
  }

  private async saveUser(user: User): Promise<void> {
    // Implementation depends on your database choice
    throw new Error('Not implemented');
  }

  private async updateLastLogin(user: User): Promise<void> {
    // Implementation depends on your database choice
    throw new Error('Not implemented');
  }

  private async resetLoginAttempts(user: User): Promise<void> {
    // Implementation depends on your database choice
    throw new Error('Not implemented');
  }

  private async updateLoginAttempts(userId: string, attempts: number, lockoutUntil?: Date): Promise<void> {
    // Implementation depends on your database choice
    throw new Error('Not implemented');
  }

  private async update2FA(userId: string, secret: string | null, enabled: boolean): Promise<void> {
    // Implementation depends on your database choice
    throw new Error('Not implemented');
  }

  private async sendEmailVerification(email: string): Promise<void> {
    // Implementation depends on your email service
    throw new Error('Not implemented');
  }

  private async logAuthEvent(event: string, userId: string, metadata: any): Promise<void> {
    // Implementation for audit logging
    throw new Error('Not implemented');
  }
}
```

### OAuth2 Integration

```typescript
interface OAuth2Provider {
  name: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string[];
}

class OAuth2Service {
  private providers: Map<string, OAuth2Provider> = new Map();
  private redis: Redis;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL!);
    this.setupProviders();
  }

  private setupProviders(): void {
    // Google OAuth2
    this.providers.set('google', {
      name: 'Google',
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      redirectUri: process.env.GOOGLE_REDIRECT_URI!,
      scope: ['openid', 'email', 'profile']
    });

    // GitHub OAuth2
    this.providers.set('github', {
      name: 'GitHub',
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      redirectUri: process.env.GITHUB_REDIRECT_URI!,
      scope: ['user:email']
    });
  }

  async getAuthorizationUrl(provider: string, state: string): Promise<string> {
    const providerConfig = this.providers.get(provider);
    if (!providerConfig) {
      throw new Error('Unsupported OAuth2 provider');
    }

    // Store state in Redis for CSRF protection
    await this.redis.setex(`oauth_state:${state}`, 600, provider); // 10 minutes

    switch (provider) {
      case 'google':
        return this.getGoogleAuthUrl(providerConfig, state);
      case 'github':
        return this.getGitHubAuthUrl(providerConfig, state);
      default:
        throw new Error('Unsupported provider');
    }
  }

  async handleCallback(
    provider: string,
    code: string,
    state: string
  ): Promise<{ user: any; tokens: AuthTokens }> {
    // Verify state parameter
    const storedProvider = await this.redis.get(`oauth_state:${state}`);
    if (storedProvider !== provider) {
      throw new Error('Invalid state parameter');
    }

    // Clean up state
    await this.redis.del(`oauth_state:${state}`);

    const providerConfig = this.providers.get(provider);
    if (!providerConfig) {
      throw new Error('Unsupported OAuth2 provider');
    }

    // Exchange code for access token
    const tokenResponse = await this.exchangeCodeForToken(provider, code, providerConfig);
    
    // Get user info from provider
    const userInfo = await this.getUserInfoFromProvider(provider, tokenResponse.access_token);

    // Find or create user
    let user = await this.findUserByEmail(userInfo.email);
    
    if (!user) {
      // Create new user
      user = await this.createOAuth2User(userInfo, provider);
    } else {
      // Link OAuth2 account if not already linked
      await this.linkOAuth2Account(user.id, provider, userInfo.id);
    }

    // Generate JWT tokens
    const authService = new AuthenticationService();
    const tokens = await authService.generateTokens(user);

    return { user: this.sanitizeUser(user), tokens };
  }

  private getGoogleAuthUrl(provider: OAuth2Provider, state: string): string {
    const params = new URLSearchParams({
      client_id: provider.clientId,
      redirect_uri: provider.redirectUri,
      scope: provider.scope.join(' '),
      response_type: 'code',
      state,
      access_type: 'offline',
      prompt: 'consent'
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  private getGitHubAuthUrl(provider: OAuth2Provider, state: string): string {
    const params = new URLSearchParams({
      client_id: provider.clientId,
      redirect_uri: provider.redirectUri,
      scope: provider.scope.join(' '),
      state
    });

    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  private async exchangeCodeForToken(
    provider: string,
    code: string,
    config: OAuth2Provider
  ): Promise<any> {
    // Implementation varies by provider
    switch (provider) {
      case 'google':
        return this.exchangeGoogleCode(code, config);
      case 'github':
        return this.exchangeGitHubCode(code, config);
      default:
        throw new Error('Unsupported provider');
    }
  }

  private async getUserInfoFromProvider(provider: string, accessToken: string): Promise<any> {
    // Implementation varies by provider
    switch (provider) {
      case 'google':
        return this.getGoogleUserInfo(accessToken);
      case 'github':
        return this.getGitHubUserInfo(accessToken);
      default:
        throw new Error('Unsupported provider');
    }
  }

  private async exchangeGoogleCode(code: string, config: OAuth2Provider): Promise<any> {
    // Google token exchange implementation
    throw new Error('Not implemented');
  }

  private async exchangeGitHubCode(code: string, config: OAuth2Provider): Promise<any> {
    // GitHub token exchange implementation
    throw new Error('Not implemented');
  }

  private async getGoogleUserInfo(accessToken: string): Promise<any> {
    // Google user info API call
    throw new Error('Not implemented');
  }

  private async getGitHubUserInfo(accessToken: string): Promise<any> {
    // GitHub user info API call
    throw new Error('Not implemented');
  }

  private async findUserByEmail(email: string): Promise<User | null> {
    // Database query to find user by email
    throw new Error('Not implemented');
  }

  private async createOAuth2User(userInfo: any, provider: string): Promise<User> {
    // Create user from OAuth2 info
    throw new Error('Not implemented');
  }

  private async linkOAuth2Account(userId: string, provider: string, providerId: string): Promise<void> {
    // Link OAuth2 account to existing user
    throw new Error('Not implemented');
  }

  private sanitizeUser(user: User): Partial<User> {
    const { passwordHash, twoFactorSecret, ...sanitized } = user;
    return sanitized;
  }
}
```

### Role-Based Access Control (RBAC)

```typescript
interface Permission {
  resource: string;
  action: string;
  conditions?: Record<string, any>;
}

interface Role {
  name: string;
  permissions: Permission[];
  description: string;
}

class RBACService {
  private roles: Map<string, Role> = new Map();

  constructor() {
    this.setupDefaultRoles();
  }

  private setupDefaultRoles(): void {
    // Admin role
    this.roles.set('admin', {
      name: 'admin',
      description: 'Full system access',
      permissions: [
        { resource: '*', action: '*' }
      ]
    });

    // User role
    this.roles.set('user', {
      name: 'user',
      description: 'Standard user access',
      permissions: [
        { resource: 'portfolio', action: 'read', conditions: { owner: true } },
        { resource: 'portfolio', action: 'write', conditions: { owner: true } },
        { resource: 'transactions', action: 'read', conditions: { owner: true } },
        { resource: 'transactions', action: 'write', conditions: { owner: true } },
        { resource: 'market-data', action: 'read' },
        { resource: 'user-profile', action: 'read', conditions: { owner: true } },
        { resource: 'user-profile', action: 'write', conditions: { owner: true } }
      ]
    });

    // Premium user role
    this.roles.set('premium', {
      name: 'premium',
      description: 'Premium user with advanced features',
      permissions: [
        ...this.roles.get('user')!.permissions,
        { resource: 'analytics', action: 'read', conditions: { owner: true } },
        { resource: 'alerts', action: 'read', conditions: { owner: true } },
        { resource: 'alerts', action: 'write', conditions: { owner: true } },
        { resource: 'api', action: 'read', conditions: { rateLimit: 'premium' } }
      ]
    });
  }

  hasPermission(
    userRoles: string[],
    resource: string,
    action: string,
    context?: Record<string, any>
  ): boolean {
    for (const roleName of userRoles) {
      const role = this.roles.get(roleName);
      if (!role) continue;

      for (const permission of role.permissions) {
        if (this.matchesPermission(permission, resource, action, context)) {
          return true;
        }
      }
    }

    return false;
  }

  private matchesPermission(
    permission: Permission,
    resource: string,
    action: string,
    context?: Record<string, any>
  ): boolean {
    // Check resource match
    if (permission.resource !== '*' && permission.resource !== resource) {
      return false;
    }

    // Check action match
    if (permission.action !== '*' && permission.action !== action) {
      return false;
    }

    // Check conditions
    if (permission.conditions && context) {
      return this.evaluateConditions(permission.conditions, context);
    }

    return true;
  }

  private evaluateConditions(conditions: Record<string, any>, context: Record<string, any>): boolean {
    for (const [key, value] of Object.entries(conditions)) {
      switch (key) {
        case 'owner':
          if (value && (!context.userId || !context.resourceUserId || context.userId !== context.resourceUserId)) {
            return false;
          }
          break;
        case 'rateLimit':
          if (context.rateLimit !== value) {
            return false;
          }
          break;
        default:
          if (context[key] !== value) {
            return false;
          }
      }
    }

    return true;
  }
}
```

### Authentication Middleware

```typescript
import { Request, Response, NextFunction } from 'express';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    roles: string[];
    emailVerified: boolean;
  };
}

class AuthMiddleware {
  private authService: AuthenticationService;
  private rbacService: RBACService;

  constructor() {
    this.authService = new AuthenticationService();
    this.rbacService = new RBACService();
  }

  authenticate() {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return res.status(401).json({ error: 'No valid authentication token provided' });
        }

        const token = authHeader.substring(7);
        const tokenData = await this.authService.verifyAccessToken(token);

        // Get user details
        const user = await this.authService.getUserById(tokenData.userId);
        if (!user) {
          return res.status(401).json({ error: 'User not found' });
        }

        req.user = {
          userId: user.id,
          email: user.email,
          roles: user.roles,
          emailVerified: user.emailVerified
        };

        next();
      } catch (error) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }
    };
  }

  requirePermission(resource: string, action: string) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const context = {
        userId: req.user.userId,
        resourceUserId: req.params.userId || req.body.userId,
        ...req.query,
        ...req.body
      };

      const hasPermission = this.rbacService.hasPermission(
        req.user.roles,
        resource,
        action,
        context
      );

      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      next();
    };
  }

  requireEmailVerification() {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (!req.user.emailVerified) {
        return res.status(403).json({ error: 'Email verification required' });
      }

      next();
    };
  }

  optional() {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const authHeader = req.headers.authorization;
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          const tokenData = await this.authService.verifyAccessToken(token);

          const user = await this.authService.getUserById(tokenData.userId);
          if (user) {
            req.user = {
              userId: user.id,
              email: user.email,
              roles: user.roles,
              emailVerified: user.emailVerified
            };
          }
        }

        next();
      } catch (error) {
        // Continue without authentication for optional auth
        next();
      }
    };
  }
}
```

## Security Best Practices

### Password Security
- Minimum 8 characters with complexity requirements
- BCrypt with salt rounds of 12+
- Password history to prevent reuse
- Secure password reset flow

### Token Security
- Short-lived access tokens (15 minutes)
- Refresh token rotation
- Token blacklisting for revocation
- Secure token storage

### Rate Limiting
- Login attempt limiting (5 attempts)
- Account lockout mechanism
- API rate limiting per user/IP
- CAPTCHA for suspicious activity

### Audit Logging
- All authentication events
- Failed login attempts
- Permission changes
- Account modifications

This authentication service provides:
- **Security**: Industry-standard security practices
- **Scalability**: Stateless JWT tokens with Redis caching
- **Flexibility**: Multiple authentication methods
- **Compliance**: Audit trails and security controls
- **User Experience**: Smooth authentication flows