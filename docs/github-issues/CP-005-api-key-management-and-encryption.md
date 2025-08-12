# CP-005: API Key Management and Encryption

## 📋 Issue Type
**Feature** - Security Infrastructure

## 🎯 Objective
Implement secure API key management system with enterprise-grade encryption, key rotation, and secure storage for cryptocurrency exchange API credentials.

## 📝 Description
Build a comprehensive API key management system that securely stores, encrypts, and manages cryptocurrency exchange API credentials. This system must handle key rotation, permission management, and provide audit trails for all key operations while maintaining the highest security standards.

## ✅ Acceptance Criteria

### Core Security Features
- [ ] AES-256-GCM encryption for API keys at rest
- [ ] Envelope encryption with master key rotation
- [ ] Secure key derivation using PBKDF2/Argon2
- [ ] Hardware Security Module (HSM) integration support
- [ ] Key escrow and recovery mechanisms
- [ ] Zero-knowledge architecture for key storage

### API Key Management
- [ ] Exchange API key registration and validation
- [ ] Automated key validation and health checks
- [ ] Permission scope management (read-only, trading, withdrawal)
- [ ] Key expiration and rotation scheduling
- [ ] Multiple key support per exchange
- [ ] Sandbox/testnet key management

### Operational Security
- [ ] Comprehensive audit logging for all key operations
- [ ] Rate limiting for key operations
- [ ] IP whitelisting for key access
- [ ] Anomaly detection for unusual key usage
- [ ] Emergency key revocation procedures
- [ ] Compliance reporting and monitoring

### Key Lifecycle Management
- [ ] Automated key rotation workflows
- [ ] Grace period handling during rotation
- [ ] Rollback mechanisms for failed rotations
- [ ] Key backup and recovery procedures
- [ ] Secure key deletion (cryptographic wiping)
- [ ] Key usage analytics and reporting

## 🛠️ Technical Architecture

### Encryption Service
```typescript
interface EncryptionService {
  // Core encryption operations
  encrypt(plaintext: string, keyId?: string): Promise<EncryptedData>;
  decrypt(encryptedData: EncryptedData): Promise<string>;
  
  // Key management
  generateMasterKey(): Promise<string>;
  rotateMasterKey(): Promise<void>;
  deriveDataKey(keyId: string): Promise<CryptoKey>;
  
  // Security operations
  secureDelete(data: string): void;
  validateIntegrity(encryptedData: EncryptedData): boolean;
}

interface EncryptedData {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyId: string;
  algorithm: string;
  timestamp: number;
}
```

### API Key Service
```typescript
interface ApiKeyService {
  // Key registration
  registerExchangeKeys(
    userId: string, 
    exchangeId: string, 
    credentials: ExchangeCredentials
  ): Promise<void>;
  
  // Key retrieval and validation
  getDecryptedKeys(userId: string, exchangeId: string): Promise<ExchangeCredentials>;
  validateKeyPermissions(keyId: string): Promise<KeyPermissions>;
  testKeyConnectivity(keyId: string): Promise<KeyHealthStatus>;
  
  // Key lifecycle
  rotateKeys(keyId: string): Promise<void>;
  revokeKeys(keyId: string, reason: string): Promise<void>;
  scheduleRotation(keyId: string, rotationDate: Date): Promise<void>;
}

interface ExchangeCredentials {
  apiKey: string;
  apiSecret: string;
  passphrase?: string;
  permissions: string[];
  sandboxMode: boolean;
}
```

### Database Schema for Key Management
```sql
-- Master keys table (stored in separate secure database)
CREATE TABLE master_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_encrypted BYTEA NOT NULL, -- Encrypted with HSM or system key
  key_hash VARCHAR(64) NOT NULL, -- SHA-256 hash for verification
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  rotated_at TIMESTAMP
);

-- Data encryption keys
CREATE TABLE data_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_key_id UUID REFERENCES master_keys(id),
  key_encrypted BYTEA NOT NULL,
  purpose VARCHAR(100) NOT NULL, -- 'api_keys', 'user_data', etc.
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP
);

-- Encrypted API credentials
CREATE TABLE encrypted_api_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  exchange_id UUID REFERENCES exchanges(id),
  credential_name VARCHAR(200),
  
  -- Encrypted fields
  api_key_encrypted BYTEA NOT NULL,
  api_secret_encrypted BYTEA NOT NULL,
  passphrase_encrypted BYTEA,
  
  -- Encryption metadata
  encryption_key_id UUID REFERENCES data_keys(id),
  encryption_algorithm VARCHAR(50) DEFAULT 'AES-256-GCM',
  iv BYTEA NOT NULL,
  auth_tag BYTEA NOT NULL,
  
  -- Key metadata
  permissions TEXT[] DEFAULT ARRAY['read'],
  is_sandbox BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Security and lifecycle
  last_validated TIMESTAMP,
  validation_status VARCHAR(50) DEFAULT 'pending',
  validation_error TEXT,
  rotation_scheduled_at TIMESTAMP,
  last_rotated_at TIMESTAMP,
  
  -- Audit fields
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_ip INET,
  last_accessed TIMESTAMP,
  access_count INTEGER DEFAULT 0,
  
  UNIQUE(user_id, exchange_id, credential_name)
);

-- Key operation audit logs
CREATE TABLE key_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  credential_id UUID REFERENCES encrypted_api_credentials(id),
  operation VARCHAR(100) NOT NULL, -- 'create', 'read', 'update', 'delete', 'rotate', 'validate'
  operation_status VARCHAR(50) NOT NULL, -- 'success', 'failure', 'partial'
  operation_details JSONB,
  error_message TEXT,
  
  -- Security context
  ip_address INET,
  user_agent TEXT,
  session_id VARCHAR(255),
  risk_score INTEGER, -- 0-100 risk assessment
  
  -- Timing
  performed_at TIMESTAMP DEFAULT NOW(),
  duration_ms INTEGER
);

-- Key rotation history
CREATE TABLE key_rotation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id UUID REFERENCES encrypted_api_credentials(id),
  old_key_hash VARCHAR(64), -- Hash of previous key for verification
  new_key_hash VARCHAR(64), -- Hash of new key
  rotation_reason VARCHAR(200),
  rotation_type VARCHAR(50), -- 'scheduled', 'manual', 'emergency', 'compromised'
  rotation_status VARCHAR(50), -- 'initiated', 'completed', 'failed', 'rolled_back'
  
  -- Timing and duration
  initiated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  grace_period_ends_at TIMESTAMP,
  
  -- Error handling
  error_message TEXT,
  rollback_reason TEXT,
  rollback_at TIMESTAMP
);
```

## 🔐 Security Implementation

### Encryption Implementation
```typescript
import { createCipher, createDecipher, randomBytes, pbkdf2Sync } from 'crypto';

class AdvancedEncryptionService {
  private readonly ALGORITHM = 'aes-256-gcm';
  private readonly KEY_LENGTH = 32;
  private readonly IV_LENGTH = 12;
  private readonly TAG_LENGTH = 16;
  private readonly SALT_LENGTH = 32;

  async encryptApiKey(
    apiKey: string, 
    masterPassword: string, 
    salt?: Buffer
  ): Promise<EncryptedApiKey> {
    // Generate salt if not provided
    const keySalt = salt || randomBytes(this.SALT_LENGTH);
    
    // Derive encryption key using PBKDF2
    const derivedKey = pbkdf2Sync(
      masterPassword, 
      keySalt, 
      100000, // iterations
      this.KEY_LENGTH, 
      'sha512'
    );
    
    // Generate IV
    const iv = randomBytes(this.IV_LENGTH);
    
    // Create cipher
    const cipher = createCipher(this.ALGORITHM, derivedKey);
    cipher.setAAD(keySalt); // Use salt as additional authenticated data
    
    // Encrypt
    let encrypted = cipher.update(apiKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Get authentication tag
    const authTag = cipher.getAuthTag();
    
    return {
      ciphertext: encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      salt: keySalt.toString('hex'),
      algorithm: this.ALGORITHM,
      timestamp: Date.now()
    };
  }

  async decryptApiKey(encryptedData: EncryptedApiKey, masterPassword: string): Promise<string> {
    const salt = Buffer.from(encryptedData.salt, 'hex');
    const iv = Buffer.from(encryptedData.iv, 'hex');
    const authTag = Buffer.from(encryptedData.authTag, 'hex');
    
    // Derive the same key
    const derivedKey = pbkdf2Sync(
      masterPassword, 
      salt, 
      100000, 
      this.KEY_LENGTH, 
      'sha512'
    );
    
    // Create decipher
    const decipher = createDecipher(this.ALGORITHM, derivedKey);
    decipher.setAuthTag(authTag);
    decipher.setAAD(salt);
    
    // Decrypt
    let decrypted = decipher.update(encryptedData.ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}
```

### Key Validation Service
```typescript
class ExchangeKeyValidator {
  async validateBinanceKeys(apiKey: string, apiSecret: string): Promise<KeyValidationResult> {
    try {
      const signature = this.generateBinanceSignature('', apiSecret);
      const response = await fetch('https://api.binance.com/api/v3/account', {
        headers: {
          'X-MBX-APIKEY': apiKey,
          'signature': signature,
          'timestamp': Date.now().toString()
        }
      });
      
      return {
        isValid: response.ok,
        permissions: await this.extractPermissions(response),
        rateLimit: response.headers.get('x-mbx-used-weight'),
        lastChecked: new Date()
      };
    } catch (error) {
      return {
        isValid: false,
        error: error.message,
        lastChecked: new Date()
      };
    }
  }
  
  async validateAllExchangeKeys(userId: string): Promise<ValidationReport> {
    const credentials = await this.getUser ExchangeCredentials(userId);
    const results: KeyValidationResult[] = [];
    
    for (const cred of credentials) {
      const result = await this.validateExchangeKey(cred);
      results.push(result);
      
      // Update database with validation result
      await this.updateValidationStatus(cred.id, result);
    }
    
    return {
      userId,
      totalKeys: credentials.length,
      validKeys: results.filter(r => r.isValid).length,
      results,
      reportGeneratedAt: new Date()
    };
  }
}
```

## 🚨 Security Monitoring

### Anomaly Detection
```typescript
class KeySecurityMonitor {
  async detectAnomalousKeyUsage(credentialId: string): Promise<SecurityAlert[]> {
    const alerts: SecurityAlert[] = [];
    
    // Check for unusual access patterns
    const recentAccess = await this.getRecentKeyAccess(credentialId, '24h');
    if (recentAccess.length > 100) { // Threshold
      alerts.push({
        type: 'HIGH_FREQUENCY_ACCESS',
        severity: 'medium',
        description: 'Unusually high API key access frequency detected'
      });
    }
    
    // Check for geographic anomalies
    const locations = recentAccess.map(a => a.ipLocation).filter(Boolean);
    const uniqueCountries = new Set(locations.map(l => l.country));
    if (uniqueCountries.size > 3) {
      alerts.push({
        type: 'GEOGRAPHIC_ANOMALY',
        severity: 'high',
        description: 'API key accessed from multiple countries'
      });
    }
    
    // Check for permission escalation attempts
    const permissionChanges = await this.getPermissionChanges(credentialId, '7d');
    if (permissionChanges.some(c => c.newPermissions.includes('withdraw'))) {
      alerts.push({
        type: 'PERMISSION_ESCALATION',
        severity: 'critical',
        description: 'Withdrawal permissions added to API key'
      });
    }
    
    return alerts;
  }
}
```

## 🧪 Testing Requirements
- [ ] Encryption/decryption unit tests
- [ ] Key rotation integration tests
- [ ] Security penetration testing
- [ ] Performance tests for key operations
- [ ] Disaster recovery testing
- [ ] Compliance audit simulation

## 🔗 Dependencies
- **Depends on**: CP-004 (Database Design), CP-002 (Authentication)
- **Blocks**: CP-016 (Exchange Integration), CP-017 (Data Sync)

## 🎯 Definition of Done
- [ ] All API keys encrypted with AES-256-GCM
- [ ] Key rotation workflows automated
- [ ] Comprehensive audit logging implemented
- [ ] Security monitoring active
- [ ] Performance benchmarks met
- [ ] Compliance requirements satisfied
- [ ] Emergency procedures documented
- [ ] Security review completed

## 📚 Resources
- [OWASP Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)
- [NIST Key Management Guidelines](https://csrc.nist.gov/publications/detail/sp/800-57-part-1/rev-5/final)
- [AWS KMS Best Practices](https://docs.aws.amazon.com/kms/latest/developerguide/best-practices.html)

## 🏷️ Labels
`security`, `encryption`, `api-management`, `critical`, `compliance`

## ⏱️ Estimated Time
**20-30 hours** for security-experienced developer

## 👥 Assignee
Requires developer with:
- Cryptography and security expertise
- Key management experience
- Compliance knowledge
- High-security system experience

---
*API key security is non-negotiable in financial applications. Implement defense-in-depth strategies.*