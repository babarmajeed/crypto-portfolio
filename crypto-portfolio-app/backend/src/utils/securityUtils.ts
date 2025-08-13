import { createHash, randomBytes } from 'crypto';
import { Request } from 'express';
import {
  RiskLevel,
  RiskAssessment,
  SecurityContext,
  AnomalyDetectionResult,
  Geolocation
} from '../types/keyManagement';

export class SecurityUtils {
  private static readonly IP_HASH_SALT = process.env.IP_HASH_SALT || 'default-salt-change-in-production';
  private static readonly MAX_RISK_SCORE = 100;

  static calculateRiskScore(factors: {
    operation: string;
    userId: string;
    ipAddress?: string;
    userAgent?: string;
    previousAttempts?: number;
    timeOfDay?: number;
    geolocation?: { country: string; city?: string };
    deviceFingerprint?: string;
    isNewDevice?: boolean;
    hasVpn?: boolean;
    hasProxy?: boolean;
    isHighValueOperation?: boolean;
  }): RiskAssessment {
    let score = 0;
    const riskFactors: string[] = [];
    const recommendations: string[] = [];

    const operationRisk: Record<string, number> = {
      'create': 20,
      'read': 5,
      'update': 15,
      'delete': 30,
      'rotate': 25,
      'revoke': 35,
      'validate': 10
    };

    score += operationRisk[factors.operation] || 10;

    if (factors.previousAttempts && factors.previousAttempts > 0) {
      const attemptsPenalty = Math.min(factors.previousAttempts * 10, 40);
      score += attemptsPenalty;
      riskFactors.push(`${factors.previousAttempts} previous failed attempts`);
    }

    if (factors.isHighValueOperation) {
      score += 15;
      riskFactors.push('High-value operation');
    }

    let level: RiskLevel;
    if (score < 20) level = 'LOW';
    else if (score < 40) level = 'MEDIUM';
    else if (score < 70) level = 'HIGH';
    else level = 'CRITICAL';

    return {
      score: Math.min(score, SecurityUtils.MAX_RISK_SCORE),
      level,
      factors: riskFactors,
      recommendations
    };
  }

  static extractSecurityContext(req: Request): SecurityContext {
    const ipAddress = SecurityUtils.getClientIP(req);
    const userAgent = req.headers['user-agent'] || 'unknown';
    
    const fingerprintData = {
      userAgent,
      acceptLanguage: req.headers['accept-language'],
      acceptEncoding: req.headers['accept-encoding']
    };
    
    const deviceFingerprint = SecurityUtils.createDeviceFingerprint(fingerprintData);

    return {
      ipAddress,
      userAgent,
      deviceFingerprint
    };
  }

  static getClientIP(req: Request): string {
    const xForwardedFor = req.headers['x-forwarded-for'];
    const xRealIP = req.headers['x-real-ip'];
    
    if (xForwardedFor) {
      const ips = (xForwardedFor as string).split(',');
      return ips[0].trim();
    }

    return (xRealIP as string) || req.socket?.remoteAddress || '0.0.0.0';
  }

  static createDeviceFingerprint(data: Record<string, any>): string {
    const normalized = JSON.stringify(data, Object.keys(data).sort());
    return createHash('sha256').update(normalized + SecurityUtils.IP_HASH_SALT).digest('hex');
  }

  static hashIP(ipAddress: string): string {
    return createHash('sha256')
      .update(ipAddress + SecurityUtils.IP_HASH_SALT)
      .digest('hex');
  }

  static generateSecurityToken(): string {
    return randomBytes(32).toString('hex');
  }
}