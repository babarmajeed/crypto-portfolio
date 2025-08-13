export interface EncryptedData {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyId: string;
  algorithm: string;
  timestamp: number;
}

export interface EncryptedApiKey extends EncryptedData {
  salt: string;
}

export interface EncryptionService {
  // Core encryption operations
  encrypt(plaintext: string, keyId?: string): Promise<EncryptedData>;
  decrypt(encryptedData: EncryptedData): Promise<string>;
  
  // Key management
  generateMasterKey(): Promise<string>;
  rotateMasterKey(): Promise<void>;
  deriveDataKey(keyId: string): Promise<Buffer>;
  
  // Security operations
  secureDelete(data: string): void;
  validateIntegrity(encryptedData: EncryptedData): boolean;
}

export interface KeyHealthStatus {
  isValid: boolean;
  permissions: string[];
  rateLimit?: string;
  lastChecked: Date;
  error?: string;
}

export interface KeyValidationResult {
  isValid: boolean;
  permissions?: string[];
  rateLimit?: string;
  lastChecked: Date;
  error?: string;
}

export interface ValidationReport {
  userId: string;
  totalKeys: number;
  validKeys: number;
  results: KeyValidationResult[];
  reportGeneratedAt: Date;
}

export interface SecurityAlert {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  timestamp?: Date;
  metadata?: Record<string, any>;
}

export interface MasterKeyData {
  id: string;
  keyEncrypted: Buffer;
  keyHash: string;
  version: number;
  isActive: boolean;
  createdAt: Date;
  expiresAt?: Date;
  rotatedAt?: Date;
}

export interface DataKeyData {
  id: string;
  masterKeyId: string;
  keyEncrypted: Buffer;
  purpose: string;
  isActive: boolean;
  createdAt: Date;
  expiresAt?: Date;
}