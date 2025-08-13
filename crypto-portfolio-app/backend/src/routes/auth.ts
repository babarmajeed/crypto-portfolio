import { Router } from 'express';
import passport from 'passport';
import { authController } from '../controllers/authController';
import { oauthController } from '../controllers/oauthController';
import { userController } from '../controllers/userController';
import { authMiddleware } from '../middleware/authMiddleware';
import { rbacMiddleware } from '../middleware/rbacMiddleware';
import { rateLimiterMiddleware } from '../middleware/rateLimiterMiddleware';
import { securityMiddleware } from '../middleware/securityMiddleware';

const authRouter = Router();

// Apply security middleware to all auth routes
authRouter.use(securityMiddleware.sanitizeRequest);
authRouter.use(securityMiddleware.sqlInjectionProtection);
authRouter.use(securityMiddleware.noSQLInjectionProtection);

// Public auth routes with rate limiting

// Registration
authRouter.post('/register', 
  rateLimiterMiddleware.registrationLimiter,
  authController.register
);

// Login
authRouter.post('/login', 
  rateLimiterMiddleware.loginLimiter,
  authController.login
);

// Token refresh
authRouter.post('/refresh-token', 
  rateLimiterMiddleware.authLimiter,
  authController.refreshToken
);

// Logout
authRouter.post('/logout', 
  rateLimiterMiddleware.authLimiter,
  authController.logout
);

// Email verification
authRouter.get('/verify-email/:token', 
  rateLimiterMiddleware.emailVerificationLimiter,
  authController.verifyEmail
);

// Resend verification email
authRouter.post('/resend-verification', 
  rateLimiterMiddleware.emailVerificationLimiter,
  authController.resendVerificationEmail
);

// Password reset request
authRouter.post('/forgot-password', 
  rateLimiterMiddleware.passwordResetLimiter,
  authController.forgotPassword
);

// Password reset
authRouter.post('/reset-password', 
  rateLimiterMiddleware.passwordResetLimiter,
  authController.resetPassword
);

// OAuth2 Routes

// Google OAuth
authRouter.get('/google', oauthController.googleAuth);
authRouter.get('/google/callback', oauthController.googleCallback);

// GitHub OAuth
authRouter.get('/github', oauthController.githubAuth);
authRouter.get('/github/callback', oauthController.githubCallback);

// OAuth account management (authenticated users only)
authRouter.post('/oauth/link/:provider', 
  authMiddleware.authenticate,
  rateLimiterMiddleware.authLimiter,
  oauthController.linkOAuthAccount
);

authRouter.delete('/oauth/unlink/:provider', 
  authMiddleware.authenticate,
  rateLimiterMiddleware.authLimiter,
  oauthController.unlinkOAuthAccount
);

authRouter.get('/oauth/linked', 
  authMiddleware.authenticate,
  rateLimiterMiddleware.roleBasedLimiter(50),
  oauthController.getLinkedAccounts
);

// Protected auth routes (require authentication)

// User profile
authRouter.get('/me', 
  authMiddleware.authenticate,
  rateLimiterMiddleware.roleBasedLimiter(100),
  authController.getProfile
);

// Change password
authRouter.post('/change-password', 
  authMiddleware.authenticate,
  rateLimiterMiddleware.twoFactorLimiter,
  authController.changePassword
);

// Two-factor authentication setup
authRouter.post('/2fa/setup', 
  authMiddleware.authenticate,
  rateLimiterMiddleware.twoFactorLimiter,
  authController.setupTwoFactor
);

// Enable two-factor authentication
authRouter.post('/2fa/enable', 
  authMiddleware.authenticate,
  rateLimiterMiddleware.twoFactorLimiter,
  authController.enableTwoFactor
);

// Disable two-factor authentication
authRouter.post('/2fa/disable', 
  authMiddleware.authenticate,
  rateLimiterMiddleware.twoFactorLimiter,
  authController.disableTwoFactor
);

// Session management
authRouter.get('/sessions', 
  authMiddleware.authenticate,
  rateLimiterMiddleware.roleBasedLimiter(50),
  authController.getUserSessions
);

authRouter.delete('/sessions/:sessionId', 
  authMiddleware.authenticate,
  rateLimiterMiddleware.authLimiter,
  authController.terminateSession
);

// User management routes

// Get user profile (detailed)
authRouter.get('/user/profile', 
  authMiddleware.authenticate,
  rateLimiterMiddleware.roleBasedLimiter(100),
  userController.getProfile
);

// Update user profile
authRouter.put('/user/profile', 
  authMiddleware.authenticate,
  rateLimiterMiddleware.authLimiter,
  userController.updateProfile
);

// Get user preferences
authRouter.get('/user/preferences', 
  authMiddleware.authenticate,
  rateLimiterMiddleware.roleBasedLimiter(100),
  userController.getPreferences
);

// Update user preferences
authRouter.put('/user/preferences', 
  authMiddleware.authenticate,
  rateLimiterMiddleware.authLimiter,
  userController.updatePreferences
);

// Change email
authRouter.post('/user/change-email', 
  authMiddleware.authenticate,
  rateLimiterMiddleware.emailVerificationLimiter,
  userController.changeEmail
);

// Get security settings
authRouter.get('/user/security', 
  authMiddleware.authenticate,
  rateLimiterMiddleware.roleBasedLimiter(50),
  userController.getSecuritySettings
);

// Get audit log
authRouter.get('/user/audit-log', 
  authMiddleware.authenticate,
  rateLimiterMiddleware.roleBasedLimiter(20),
  userController.getAuditLog
);

// Terminate all sessions
authRouter.post('/user/terminate-all-sessions', 
  authMiddleware.authenticate,
  rateLimiterMiddleware.authLimiter,
  userController.terminateAllSessions
);

// Export user data
authRouter.get('/user/export', 
  authMiddleware.authenticate,
  rateLimiterMiddleware.customLimiter({
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    max: 1, // 1 export per day
    message: 'Data export is limited to once per day'
  }),
  userController.exportData
);

// Delete user account
authRouter.delete('/user/account', 
  authMiddleware.authenticate,
  rateLimiterMiddleware.customLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 1, // 1 deletion attempt per hour
    message: 'Account deletion is limited to one attempt per hour'
  }),
  userController.deleteAccount
);

// Get user statistics
authRouter.get('/user/stats', 
  authMiddleware.authenticate,
  rateLimiterMiddleware.roleBasedLimiter(50),
  userController.getStats
);

// Admin routes (admin access only)

// Get user permissions (useful for frontend)
authRouter.get('/permissions', 
  authMiddleware.authenticate,
  rateLimiterMiddleware.roleBasedLimiter(50),
  rbacMiddleware.getUserPermissions
);

// Health check for auth service (no authentication required)
authRouter.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Authentication service is healthy',
    timestamp: new Date().toISOString()
  });
});

export { authRouter };