import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { auditMiddleware } from '../middleware/auditMiddleware';
import { securityController } from '../controllers/securityController';
import { rateLimitService } from '../services/rateLimitService';

const router = Router();

// Strict rate limiting for security operations
const securityRateLimit = rateLimitService.createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 security operations per window
  message: 'Too many security operations. Please try again later.',
  skipSuccessfulRequests: false
});

const auditRateLimit = rateLimitService.createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 audit requests per minute
  message: 'Too many audit log requests. Please try again later.'
});

/**
 * @route GET /api/security/overview
 * @desc Get security overview
 * @access Private
 */
router.get('/overview',
  authMiddleware.authenticate,
  auditMiddleware.skip, // Don't audit overview reads
  securityController.getSecurityOverview
);

/**
 * @route GET /api/security/audit-logs
 * @desc Get user audit logs with filtering and pagination
 * @access Private
 */
router.get('/audit-logs',
  auditRateLimit,
  authMiddleware.authenticate,
  auditMiddleware.skip, // Don't audit log reads
  securityController.getAuditLogs
);

/**
 * @route GET /api/security/events
 * @desc Get security-related events
 * @access Private
 */
router.get('/events',
  auditRateLimit,
  authMiddleware.authenticate,
  auditMiddleware.skip,
  securityController.getSecurityEvents
);

/**
 * @route POST /api/security/devices
 * @desc Manage trusted devices (trust, remove, list)
 * @access Private
 */
router.post('/devices',
  securityRateLimit,
  authMiddleware.authenticate,
  auditMiddleware.deviceTrust,
  securityController.manageTrustedDevices,
  auditMiddleware.log
);

/**
 * @route POST /api/security/devices/trust-current
 * @desc Trust the current device
 * @access Private
 */
router.post('/devices/trust-current',
  securityRateLimit,
  authMiddleware.authenticate,
  auditMiddleware.deviceTrust,
  securityController.trustCurrentDevice,
  auditMiddleware.log
);

/**
 * @route DELETE /api/security/devices/:deviceId
 * @desc Remove a trusted device by ID
 * @access Private
 */
router.delete('/devices/:deviceId',
  securityRateLimit,
  authMiddleware.authenticate,
  auditMiddleware.deviceRemove,
  securityController.removeTrustedDevice,
  auditMiddleware.log
);

/**
 * @route POST /api/security/devices/cleanup
 * @desc Clean up inactive devices
 * @access Private
 */
router.post('/devices/cleanup',
  rateLimitService.createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 cleanups per hour
    message: 'Too many device cleanup operations. Please try again later.'
  }),
  authMiddleware.authenticate,
  auditMiddleware.setAuditInfo('DEVICE_CLEANUP', 'TrustedDevice'),
  securityController.cleanupInactiveDevices,
  auditMiddleware.log
);

/**
 * @route GET /api/security/devices/check
 * @desc Check if current device is trusted
 * @access Private
 */
router.get('/devices/check',
  authMiddleware.authenticate,
  auditMiddleware.skip,
  securityController.checkDeviceTrust
);

export default router;