# ADR-003: Authentication and Authorization Strategy

## Status
Accepted

## Context
Our crypto portfolio application requires a robust authentication and authorization system that:
- Secures user accounts containing sensitive financial data
- Supports multiple authentication methods (password, OAuth2, 2FA)
- Provides role-based access control (RBAC)
- Scales to support thousands of concurrent users
- Meets security compliance requirements for financial applications
- Integrates with external identity providers
- Supports API access for third-party integrations

## Decision
We will implement a **comprehensive authentication and authorization system** with the following components:

1. **JWT-based authentication** with short-lived access tokens
2. **Refresh token rotation** for enhanced security
3. **Multi-factor authentication (2FA)** using TOTP
4. **OAuth2 integration** for social login
5. **Role-based access control (RBAC)** with fine-grained permissions
6. **API key authentication** for third-party access
7. **Session management** with Redis backend

## Rationale

### JWT with Refresh Token Strategy

**Why JWT:**
- **Stateless**: No server-side session storage required
- **Scalable**: Can be verified by any service instance
- **Portable**: Works across different services and platforms
- **Standards-based**: Industry standard (RFC 7519)
- **Rich payload**: Can carry user context and permissions

**Token Strategy:**
```
Access Token:  15 minutes expiry, contains user context
Refresh Token: 7 days expiry, used to obtain new access tokens
```

**Advantages:**
- **Security**: Short-lived access tokens limit exposure
- **Performance**: No database lookup for token validation
- **Flexibility**: Easy to revoke via blacklisting
- **Auditability**: Complete token lifecycle tracking

### Multi-Factor Authentication (2FA)

**Implementation:**
- **TOTP (Time-based One-Time Password)** using RFC 6238
- **Backup codes** for account recovery
- **SMS fallback** for users without authenticator apps
- **Hardware keys** support (future enhancement)

**Libraries:**
- **speakeasy**: TOTP generation and verification
- **qrcode**: QR code generation for setup

**Security Benefits:**
- **Reduces account takeover risk** by 99.9%
- **Compliance**: Meets regulatory requirements
- **User trust**: Demonstrates security commitment

### OAuth2 Integration

**Supported Providers:**
- Google OAuth2
- GitHub OAuth2
- Microsoft Azure AD
- Custom OIDC providers

**Implementation Pattern:**
```
1. User initiates OAuth flow
2. Redirect to provider with state parameter
3. Provider callback with authorization code
4. Exchange code for access token
5. Fetch user profile from provider
6. Create or link local account
7. Generate application JWT tokens
```

**Benefits:**
- **Reduced friction**: No password creation required
- **Security**: Leverages provider's security measures
- **User convenience**: Single sign-on experience

### Role-Based Access Control (RBAC)

**Role Hierarchy:**
```
Admin > Premium > User > Guest
```

**Permission Model:**
```typescript
interface Permission {
  resource: string;    // portfolio, market-data, analytics
  action: string;      // read, write, delete, admin
  conditions?: object; // owner: true, rateLimit: premium
}
```

**Built-in Roles:**
```yaml
guest:
  permissions:
    - resource: "market-data"
      action: "read"
      conditions: { rateLimit: "basic" }

user:
  permissions:
    - resource: "portfolio"
      action: "read"
      conditions: { owner: true }
    - resource: "portfolio"
      action: "write"
      conditions: { owner: true }
    - resource: "market-data"
      action: "read"

premium:
  inherits: ["user"]
  permissions:
    - resource: "analytics"
      action: "read"
      conditions: { owner: true }
    - resource: "api"
      action: "read"
      conditions: { rateLimit: "premium" }

admin:
  permissions:
    - resource: "*"
      action: "*"
```

## Architecture Design

### Authentication Flow
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Client    │    │API Gateway  │    │Auth Service │
│             │    │             │    │             │
│ 1. Login    │───▶│ 2. Forward  │───▶│ 3. Validate │
│ Request     │    │ Request     │    │ Credentials │
│             │    │             │    │             │
│ 6. Access   │◀───│ 5. Return   │◀───│ 4. Generate │
│ Resources   │    │ Tokens      │    │ JWT Tokens  │
└─────────────┘    └─────────────┘    └─────────────┘
```

### Token Validation Flow
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Client    │    │API Gateway  │    │   Service   │
│             │    │             │    │             │
│ 1. API      │───▶│ 2. Validate │    │             │
│ Request     │    │ JWT Token   │    │             │
│ + Token     │    │             │    │             │
│             │    │ 3. Add User │───▶│ 4. Process  │
│ 6. Response │◀───│ Context     │    │ Request     │
│             │    │             │    │             │
└─────────────┘    └─────────────┘    └─────────────┘
```

### Database Schema

```sql
-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    email_verified BOOLEAN DEFAULT false,
    two_factor_enabled BOOLEAN DEFAULT false,
    two_factor_secret VARCHAR(255),
    account_locked BOOLEAN DEFAULT false,
    login_attempts INTEGER DEFAULT 0,
    lockout_until TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User roles
CREATE TABLE user_roles (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL,
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    granted_by UUID REFERENCES users(id),
    PRIMARY KEY (user_id, role)
);

-- OAuth accounts
CREATE TABLE oauth_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    provider_account_id VARCHAR(255) NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    expires_at TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(provider, provider_account_id)
);

-- API keys
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    key_hash VARCHAR(255) NOT NULL,
    permissions JSONB,
    rate_limit INTEGER DEFAULT 1000,
    last_used_at TIMESTAMP,
    expires_at TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Auth sessions
CREATE TABLE auth_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    refresh_token_hash VARCHAR(255) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit log
CREATE TABLE auth_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    event_type VARCHAR(50) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    success BOOLEAN,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Security Implementation

### Password Security
```typescript
class PasswordSecurity {
  private readonly SALT_ROUNDS = 12;
  private readonly MIN_PASSWORD_LENGTH = 8;
  
  async hashPassword(password: string): Promise<string> {
    this.validatePasswordStrength(password);
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }
  
  private validatePasswordStrength(password: string): void {
    const requirements = [
      { regex: /.{8,}/, message: 'At least 8 characters' },
      { regex: /[A-Z]/, message: 'At least one uppercase letter' },
      { regex: /[a-z]/, message: 'At least one lowercase letter' },
      { regex: /\d/, message: 'At least one number' },
      { regex: /[^A-Za-z0-9]/, message: 'At least one special character' }
    ];
    
    for (const req of requirements) {
      if (!req.regex.test(password)) {
        throw new Error(`Password must contain: ${req.message}`);
      }
    }
  }
}
```

### JWT Implementation
```typescript
class JWTService {
  private readonly ACCESS_TOKEN_EXPIRY = '15m';
  private readonly REFRESH_TOKEN_EXPIRY = '7d';
  
  generateTokens(user: User): AuthTokens {
    const payload = {
      userId: user.id,
      email: user.email,
      roles: user.roles,
      permissions: this.getUserPermissions(user.roles),
      emailVerified: user.emailVerified
    };
    
    const accessToken = jwt.sign(payload, process.env.JWT_SECRET!, {
      expiresIn: this.ACCESS_TOKEN_EXPIRY,
      issuer: 'crypto-portfolio-auth',
      audience: 'crypto-portfolio-api'
    });
    
    const refreshToken = jwt.sign(
      { userId: user.id, tokenType: 'refresh' },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: this.REFRESH_TOKEN_EXPIRY }
    );
    
    return { accessToken, refreshToken };
  }
}
```

### Rate Limiting Strategy

**Implementation Levels:**
1. **API Gateway**: Global rate limiting by IP
2. **Authentication Endpoints**: Stricter limits on auth operations
3. **User-based**: Limits based on user role and subscription
4. **Resource-based**: Different limits for different endpoints

```typescript
const rateLimits = {
  global: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000 // requests per window per IP
  },
  auth: {
    login: { windowMs: 15 * 60 * 1000, max: 5 },    // 5 attempts per 15 min
    register: { windowMs: 60 * 60 * 1000, max: 3 }, // 3 attempts per hour
    password_reset: { windowMs: 60 * 60 * 1000, max: 3 }
  },
  api: {
    user: { windowMs: 60 * 1000, max: 100 },      // 100 req/min
    premium: { windowMs: 60 * 1000, max: 500 },   // 500 req/min
    admin: { windowMs: 60 * 1000, max: 2000 }     // 2000 req/min
  }
};
```

## Session Management

### Redis Session Storage
```typescript
class SessionManager {
  private redis: Redis;
  
  async createSession(userId: string, metadata: SessionMetadata): Promise<string> {
    const sessionId = generateSecureId();
    const sessionData = {
      userId,
      createdAt: Date.now(),
      lastAccess: Date.now(),
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent
    };
    
    // Store session with 7-day expiry
    await this.redis.setex(
      `session:${sessionId}`,
      7 * 24 * 60 * 60,
      JSON.stringify(sessionData)
    );
    
    // Track user sessions
    await this.redis.sadd(`user:sessions:${userId}`, sessionId);
    
    return sessionId;
  }
  
  async validateSession(sessionId: string): Promise<SessionData | null> {
    const sessionData = await this.redis.get(`session:${sessionId}`);
    
    if (!sessionData) {
      return null;
    }
    
    // Update last access time
    const session = JSON.parse(sessionData);
    session.lastAccess = Date.now();
    
    await this.redis.setex(
      `session:${sessionId}`,
      7 * 24 * 60 * 60,
      JSON.stringify(session)
    );
    
    return session;
  }
}
```

## API Key Authentication

### API Key Management
```typescript
class APIKeyService {
  async createAPIKey(userId: string, name: string, permissions: Permission[]): Promise<APIKey> {
    const key = this.generateAPIKey();
    const keyHash = await bcrypt.hash(key, 12);
    
    const apiKey = {
      id: generateUUID(),
      userId,
      name,
      keyHash,
      permissions,
      rateLimit: this.calculateRateLimit(permissions),
      createdAt: new Date()
    };
    
    await this.saveAPIKey(apiKey);
    
    // Return key only once for security
    return { ...apiKey, key }; // key is only returned here
  }
  
  async validateAPIKey(key: string): Promise<APIKeyData | null> {
    const keyData = await this.getAPIKeyByPrefix(key.substring(0, 8));
    
    if (!keyData || !await bcrypt.compare(key, keyData.keyHash)) {
      return null;
    }
    
    // Update last used timestamp
    await this.updateLastUsed(keyData.id);
    
    return keyData;
  }
  
  private generateAPIKey(): string {
    // Format: cp_live_1234567890abcdef1234567890abcdef
    const prefix = 'cp_live_';
    const randomBytes = crypto.randomBytes(32).toString('hex');
    return prefix + randomBytes;
  }
}
```

## Compliance and Audit

### Audit Logging
```typescript
class AuthAuditLogger {
  async logAuthEvent(event: AuthEvent): Promise<void> {
    const auditEntry = {
      userId: event.userId,
      eventType: event.type,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      success: event.success,
      details: {
        errorMessage: event.error?.message,
        metadata: event.metadata
      },
      timestamp: new Date()
    };
    
    // Store in database for compliance
    await this.saveAuditEntry(auditEntry);
    
    // Send to monitoring system
    if (!event.success) {
      await this.alertSecurityTeam(auditEntry);
    }
  }
}
```

### Security Monitoring
- **Failed login attempts**: Alert after 5 failed attempts
- **Unusual access patterns**: Login from new devices/locations
- **Permission escalation**: Role changes and admin access
- **API key usage**: Monitoring for abuse patterns

## Migration and Rollout Strategy

### Phase 1: Core Authentication (Week 1-2)
1. Basic JWT authentication
2. Password-based login
3. User registration and email verification

### Phase 2: Enhanced Security (Week 3-4)
1. 2FA implementation
2. Rate limiting
3. Session management

### Phase 3: OAuth Integration (Week 5-6)
1. Google OAuth2
2. GitHub OAuth2
3. Account linking

### Phase 4: API Keys and RBAC (Week 7-8)
1. API key authentication
2. Role-based permissions
3. Audit logging

## Alternatives Considered

### Authentication as a Service (Auth0, Firebase Auth)
**Pros:**
- Reduced development time
- Professional security implementation
- Built-in compliance features

**Cons:**
- Vendor lock-in
- Monthly costs based on MAU
- Less control over customization
- Data residency concerns

**Decision**: Build in-house for cost control and customization needs

### Single Sign-On (SSO) Solutions
**Considered**: SAML, OIDC providers like Okta, Azure AD
**Decision**: OAuth2 integration provides similar benefits with more flexibility

### Passwordless Authentication
**Considered**: Magic links, WebAuthn
**Decision**: Deferred to future enhancement due to user adoption concerns

## Testing Strategy

### Unit Tests
- Password validation and hashing
- JWT token generation and validation
- Permission checking logic
- 2FA TOTP generation and verification

### Integration Tests
- End-to-end authentication flows
- OAuth2 provider integration
- Rate limiting behavior
- Session management

### Security Tests
- Penetration testing of auth endpoints
- Brute force attack simulation
- Token manipulation attempts
- SQL injection in auth queries

## Success Metrics

### Security Metrics
- **Zero** successful brute force attacks
- **< 0.1%** false positive rate for fraud detection
- **< 1%** user lockout rate due to security measures

### Performance Metrics
- **< 200ms** authentication response time
- **< 50ms** token validation time
- **99.9%** authentication service uptime

### User Experience Metrics
- **< 5%** user dropout during registration
- **> 80%** OAuth2 adoption rate
- **< 2%** support tickets related to authentication

This authentication strategy provides a robust, scalable, and secure foundation for our crypto portfolio application while maintaining flexibility for future enhancements.