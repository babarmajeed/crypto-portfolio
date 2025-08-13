import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { auditMiddleware } from '../middleware/auditMiddleware';
import { uploadMiddleware } from '../middleware/uploadMiddleware';
import { userController } from '../controllers/userController';
import { rateLimitService } from '../services/rateLimitService';

const router = Router();

// Rate limiting for sensitive operations
const sensitiveRateLimit = rateLimitService.createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: 'Too many sensitive operations. Please try again later.',
  skipSuccessfulRequests: true
});

const uploadRateLimit = rateLimitService.createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 3, // 3 uploads per minute
  message: 'Too many upload requests. Please try again later.'
});

// Profile Routes
/**
 * @route GET /api/users/profile
 * @desc Get current user profile
 * @access Private
 */
router.get('/profile', 
  authMiddleware.authenticate,
  auditMiddleware.skip, // Don't audit profile reads
  userController.getProfile
);

/**
 * @route PUT /api/users/profile
 * @desc Update user profile information
 * @access Private
 */
router.put('/profile',
  authMiddleware.authenticate,
  auditMiddleware.profileUpdate,
  auditMiddleware.capture('profile'),
  userController.updateProfile,
  auditMiddleware.log
);

/**
 * @route POST /api/users/avatar
 * @desc Upload user avatar
 * @access Private
 */
router.post('/avatar',
  uploadRateLimit,
  authMiddleware.authenticate,
  uploadMiddleware.avatar,
  uploadMiddleware.process,
  auditMiddleware.avatarUpdate,
  userController.uploadAvatar,
  auditMiddleware.log,
  uploadMiddleware.error
);

/**
 * @route DELETE /api/users/avatar
 * @desc Delete user avatar
 * @access Private
 */
router.delete('/avatar',
  authMiddleware.authenticate,
  auditMiddleware.avatarUpdate,
  userController.deleteAvatar,
  auditMiddleware.log
);

// Account Management Routes
/**
 * @route PUT /api/users/password
 * @desc Change user password
 * @access Private
 */
router.put('/password',
  sensitiveRateLimit,
  authMiddleware.authenticate,
  authMiddleware.requireTwoFactor,
  auditMiddleware.passwordChange,
  userController.changePassword
);

/**
 * @route PUT /api/users/email
 * @desc Change user email
 * @access Private
 */
router.put('/email',
  sensitiveRateLimit,
  authMiddleware.authenticate,
  authMiddleware.requireTwoFactor,
  auditMiddleware.emailChange,
  userController.changeEmail
);

/**
 * @route DELETE /api/users/account
 * @desc Delete user account (soft delete)
 * @access Private
 */
router.delete('/account',
  sensitiveRateLimit,
  authMiddleware.authenticate,
  authMiddleware.requireTwoFactor,
  auditMiddleware.accountDelete,
  userController.deleteAccount
);

// Data Export Routes (GDPR Compliance)
/**
 * @route GET /api/users/export
 * @desc Export user data
 * @access Private
 */
router.get('/export',
  rateLimitService.createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 2, // 2 exports per hour
    message: 'Too many export requests. Please try again later.'
  }),
  authMiddleware.authenticate,
  authMiddleware.requireTwoFactor,
  auditMiddleware.dataExport,
  userController.exportData
);

// Activity and Security Overview
/**
 * @route GET /api/users/activity
 * @desc Get user activity log
 * @access Private
 */
router.get('/activity',
  authMiddleware.authenticate,
  auditMiddleware.skip,
  userController.getActivity
);

/**
 * @route GET /api/users/security
 * @desc Get security overview
 * @access Private
 */
router.get('/security',
  authMiddleware.authenticate,
  auditMiddleware.skip,
  userController.getSecurityOverview
);

// Serve uploaded avatars (development only)
if (process.env.NODE_ENV !== 'production') {
  /**
   * @route GET /api/users/uploads/*
   * @desc Serve uploaded files
   * @access Public (for development only)
   */
  router.get('/uploads/*', uploadMiddleware.serve);
}

// Health check for upload system
/**
 * @route GET /api/users/upload-health
 * @desc Check upload system health
 * @access Private (Admin only)
 */
router.get('/upload-health',
  authMiddleware.authenticate,
  authMiddleware.requireAdmin,
  async (req, res) => {
    try {
      const health = await uploadMiddleware.health();
      res.json({
        success: true,
        data: health
      });
    } catch (error) {
      res.status(500).json({ error: 'Health check failed' });
    }
  }
);

export default router;