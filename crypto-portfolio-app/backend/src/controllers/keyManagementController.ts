import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { ApiKeyService } from '../services/apiKeyService';
import { AdvancedEncryptionService } from '../services/advancedEncryptionService';
import { ExchangeKeyValidator } from '../services/exchangeKeyValidator';
import { KeySecurityMonitor } from '../services/keySecurityMonitor';
import { SecurityUtils } from '../utils/securityUtils';
import { CryptoUtils } from '../utils/cryptoUtils';
import { z } from 'zod';

// Validation schemas
const RegisterKeysSchema = z.object({
  exchangeId: z.string().uuid(),
  apiKey: z.string().min(16).max(256),
  apiSecret: z.string().min(16).max(256),
  passphrase: z.string().optional(),
  permissions: z.array(z.string()).min(1),
  sandboxMode: z.boolean().default(false),
  credentialName: z.string().optional()
});

const RotateKeysSchema = z.object({
  rotationReason: z.string().min(1).max(500),
  gracePeriodHours: z.number().min(1).max(168).default(24) // 1 hour to 1 week
});

const RevokeKeysSchema = z.object({
  reason: z.string().min(1).max(500),
  emergencyRevoke: z.boolean().default(false)
});

export class KeyManagementController {
  private readonly prisma: PrismaClient;
  private readonly apiKeyService: ApiKeyService;
  private readonly encryptionService: AdvancedEncryptionService;
  private readonly keyValidator: ExchangeKeyValidator;
  private readonly securityMonitor: KeySecurityMonitor;

  constructor(
    prisma: PrismaClient,
    apiKeyService: ApiKeyService,
    encryptionService: AdvancedEncryptionService,
    keyValidator: ExchangeKeyValidator,
    securityMonitor: KeySecurityMonitor
  ) {
    this.prisma = prisma;
    this.apiKeyService = apiKeyService;
    this.encryptionService = encryptionService;
    this.keyValidator = keyValidator;
    this.securityMonitor = securityMonitor;
  }

  /**
   * Register new API keys for an exchange
   */
  registerKeys = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Validate input
      const validatedData = RegisterKeysSchema.parse(req.body);
      
      // Extract security context
      const securityContext = SecurityUtils.extractSecurityContext(req);
      
      // Calculate risk score
      const riskAssessment = SecurityUtils.calculateRiskScore({
        operation: 'create',
        userId,
        ...securityContext,
        isHighValueOperation: true
      });

      // High-risk operations require additional verification
      if (riskAssessment.level === 'critical') {
        res.status(429).json({
          error: 'Security review required',
          riskLevel: riskAssessment.level,
          recommendations: riskAssessment.recommendations
        });
        return;
      }

      // Validate exchange exists
      const exchange = await this.prisma.exchange.findUnique({
        where: { id: validatedData.exchangeId }
      });

      if (!exchange) {
        res.status(404).json({ error: 'Exchange not found' });
        return;
      }

      // Validate key format
      const formatValidation = this.keyValidator.validateKeyFormat(
        exchange.name,
        validatedData.apiKey,
        validatedData.apiSecret
      );

      if (!formatValidation.isValid) {
        res.status(400).json({
          error: 'Invalid API key format',
          issues: formatValidation.issues
        });
        return;
      }

      // Test connectivity before storing
      let connectivityResult;
      switch (exchange.name.toLowerCase()) {
        case 'binance':
          connectivityResult = await this.keyValidator.validateBinanceKeys(
            validatedData.apiKey,
            validatedData.apiSecret,
            validatedData.sandboxMode
          );
          break;
        case 'coinbase':
          if (!validatedData.passphrase) {
            res.status(400).json({ error: 'Passphrase required for Coinbase' });
            return;
          }
          connectivityResult = await this.keyValidator.validateCoinbaseKeys(
            validatedData.apiKey,
            validatedData.apiSecret,
            validatedData.passphrase,
            validatedData.sandboxMode
          );
          break;
        case 'kraken':
          connectivityResult = await this.keyValidator.validateKrakenKeys(
            validatedData.apiKey,
            validatedData.apiSecret
          );
          break;
        default:
          connectivityResult = { isValid: true, permissions: validatedData.permissions, lastChecked: new Date() };
      }

      if (!connectivityResult.isValid) {
        res.status(400).json({
          error: 'API key validation failed',
          details: connectivityResult.error
        });
        return;
      }

      // Register the keys
      const credentialId = await this.apiKeyService.registerExchangeKeys(
        userId,
        validatedData.exchangeId,
        {
          apiKey: validatedData.apiKey,
          apiSecret: validatedData.apiSecret,
          passphrase: validatedData.passphrase,
          permissions: validatedData.permissions,
          sandboxMode: validatedData.sandboxMode
        },
        validatedData.credentialName
      );

      // Monitor for anomalies
      await this.securityMonitor.logSecurityEvent({
        userId,
        operation: 'REGISTER_API_KEYS',
        exchangeId: validatedData.exchangeId,
        riskScore: riskAssessment.score,
        securityContext,
        metadata: {
          permissions: validatedData.permissions,
          sandboxMode: validatedData.sandboxMode
        }
      });

      res.status(201).json({
        message: 'API keys registered successfully',
        credentialId,
        connectivityStatus: connectivityResult,
        riskLevel: riskAssessment.level
      });
    } catch (error) {
      console.error('Key registration error:', error);
      
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation failed',
          details: error.errors
        });
        return;
      }

      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  };

  /**
   * Get user's API keys (metadata only, no actual keys)
   */
  getUserKeys = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const keys = await this.apiKeyService.listUserKeys(userId);
      
      res.json({
        keys,
        total: keys.length,
        active: keys.filter(k => k.isActive).length
      });
    } catch (error) {
      console.error('Get user keys error:', error);
      res.status(500).json({
        error: 'Failed to retrieve API keys',
        message: error.message
      });
    }
  };

  /**
   * Test API key connectivity
   */
  testKeyConnectivity = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { keyId } = req.params;

      // Verify key ownership
      const credential = await this.prisma.encryptedApiCredential.findFirst({
        where: {
          credentialId: keyId,
          userId,
          isActive: true
        }
      });

      if (!credential) {
        res.status(404).json({ error: 'API credential not found' });
        return;
      }

      const healthStatus = await this.apiKeyService.testKeyConnectivity(keyId);
      
      res.json({
        keyId,
        healthStatus,
        lastChecked: new Date()
      });
    } catch (error) {
      console.error('Key connectivity test error:', error);
      res.status(500).json({
        error: 'Connectivity test failed',
        message: error.message
      });
    }
  };

  /**
   * Rotate API keys
   */
  rotateKeys = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { keyId } = req.params;
      const validatedData = RotateKeysSchema.parse(req.body);

      // Verify key ownership
      const credential = await this.prisma.encryptedApiCredential.findFirst({
        where: {
          credentialId: keyId,
          userId,
          isActive: true
        }
      });

      if (!credential) {
        res.status(404).json({ error: 'API credential not found' });
        return;
      }

      // Security check for rotation
      const securityContext = SecurityUtils.extractSecurityContext(req);
      const riskAssessment = SecurityUtils.calculateRiskScore({
        operation: 'rotate',
        userId,
        ...securityContext,
        isHighValueOperation: true
      });

      if (riskAssessment.level === 'critical') {
        res.status(429).json({
          error: 'Security review required for key rotation',
          riskLevel: riskAssessment.level
        });
        return;
      }

      await this.apiKeyService.rotateKeys(keyId);

      res.json({
        message: 'Key rotation initiated',
        keyId,
        gracePeriodHours: validatedData.gracePeriodHours,
        riskLevel: riskAssessment.level
      });
    } catch (error) {
      console.error('Key rotation error:', error);
      res.status(500).json({
        error: 'Key rotation failed',
        message: error.message
      });
    }
  };

  /**
   * Revoke API keys
   */
  revokeKeys = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { keyId } = req.params;
      const validatedData = RevokeKeysSchema.parse(req.body);

      // Verify key ownership
      const credential = await this.prisma.encryptedApiCredential.findFirst({
        where: {
          credentialId: keyId,
          userId,
          isActive: true
        }
      });

      if (!credential) {
        res.status(404).json({ error: 'API credential not found' });
        return;
      }

      await this.apiKeyService.revokeKeys(keyId, validatedData.reason);

      // Monitor security event
      const securityContext = SecurityUtils.extractSecurityContext(req);
      await this.securityMonitor.logSecurityEvent({
        userId,
        operation: 'REVOKE_API_KEYS',
        exchangeId: credential.exchangeId,
        riskScore: validatedData.emergencyRevoke ? 80 : 30,
        securityContext,
        metadata: {
          reason: validatedData.reason,
          emergencyRevoke: validatedData.emergencyRevoke
        }
      });

      res.json({
        message: 'API keys revoked successfully',
        keyId,
        revokedAt: new Date()
      });
    } catch (error) {
      console.error('Key revocation error:', error);
      res.status(500).json({
        error: 'Key revocation failed',
        message: error.message
      });
    }
  };

  /**
   * Delete API keys
   */
  deleteKeys = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { keyId } = req.params;

      // Verify key ownership
      const credential = await this.prisma.encryptedApiCredential.findFirst({
        where: {
          credentialId: keyId,
          userId
        }
      });

      if (!credential) {
        res.status(404).json({ error: 'API credential not found' });
        return;
      }

      await this.apiKeyService.deleteKeys(keyId);

      res.json({
        message: 'API keys deleted successfully',
        keyId
      });
    } catch (error) {
      console.error('Key deletion error:', error);
      res.status(500).json({
        error: 'Key deletion failed',
        message: error.message
      });
    }
  };

  /**
   * Get key usage analytics
   */
  getKeyAnalytics = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { timeframe = '7d' } = req.query;

      // Get usage analytics
      const analytics = await this.securityMonitor.getKeyUsageAnalytics(userId, timeframe as string);

      res.json(analytics);
    } catch (error) {
      console.error('Key analytics error:', error);
      res.status(500).json({
        error: 'Failed to retrieve analytics',
        message: error.message
      });
    }
  };

  /**
   * Get security alerts for user's keys
   */
  getSecurityAlerts = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const alerts = await this.securityMonitor.getActiveSecurityAlerts(userId);

      res.json({
        alerts,
        total: alerts.length,
        critical: alerts.filter(a => a.severity === 'critical').length,
        high: alerts.filter(a => a.severity === 'high').length
      });
    } catch (error) {
      console.error('Security alerts error:', error);
      res.status(500).json({
        error: 'Failed to retrieve security alerts',
        message: error.message
      });
    }
  };

  /**
   * Get key rotation schedule
   */
  getRotationSchedule = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const schedule = await this.prisma.encryptedApiCredential.findMany({
        where: {
          userId,
          isActive: true,
          nextRotation: {
            not: null
          }
        },
        include: {
          exchange: {
            select: {
              name: true,
              displayName: true
            }
          }
        },
        orderBy: {
          nextRotation: 'asc'
        }
      });

      const formattedSchedule = schedule.map(cred => ({
        credentialId: cred.credentialId,
        exchangeName: cred.exchange.displayName,
        nextRotation: cred.nextRotation,
        daysUntilRotation: cred.nextRotation 
          ? Math.ceil((cred.nextRotation.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : null,
        rotationPeriod: cred.rotationPeriod
      }));

      res.json({
        schedule: formattedSchedule,
        upcoming: formattedSchedule.filter(s => s.daysUntilRotation && s.daysUntilRotation <= 7).length
      });
    } catch (error) {
      console.error('Rotation schedule error:', error);
      res.status(500).json({
        error: 'Failed to retrieve rotation schedule',
        message: error.message
      });
    }
  };

  /**
   * Update key settings
   */
  updateKeySettings = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { keyId } = req.params;
      const { rotationPeriod, ipWhitelist, geographicRestrictions } = req.body;

      // Verify key ownership
      const credential = await this.prisma.encryptedApiCredential.findFirst({
        where: {
          credentialId: keyId,
          userId,
          isActive: true
        }
      });

      if (!credential) {
        res.status(404).json({ error: 'API credential not found' });
        return;
      }

      // Update settings
      const updateData: any = {};
      
      if (rotationPeriod) {
        updateData.rotationPeriod = rotationPeriod;
        updateData.nextRotation = new Date(Date.now() + rotationPeriod * 1000);
      }
      
      if (ipWhitelist) {
        updateData.ipWhitelist = ipWhitelist;
      }
      
      if (geographicRestrictions) {
        updateData.geographicRestrictions = geographicRestrictions;
      }

      await this.prisma.encryptedApiCredential.update({
        where: { credentialId: keyId },
        data: updateData
      });

      res.json({
        message: 'Key settings updated successfully',
        keyId,
        updatedFields: Object.keys(updateData)
      });
    } catch (error) {
      console.error('Update key settings error:', error);
      res.status(500).json({
        error: 'Failed to update key settings',
        message: error.message
      });
    }
  };
}