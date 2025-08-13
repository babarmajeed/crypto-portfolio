import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { auditMiddleware } from '../middleware/auditMiddleware';
import { preferencesController } from '../controllers/preferencesController';
import { rateLimitService } from '../services/rateLimitService';

const router = Router();

// Rate limiting for preferences updates
const preferencesRateLimit = rateLimitService.createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 updates per minute
  message: 'Too many preference updates. Please try again later.'
});

/**
 * @route GET /api/preferences
 * @desc Get user preferences
 * @access Private
 */
router.get('/',
  authMiddleware.authenticate,
  auditMiddleware.skip, // Don't audit preference reads
  preferencesController.getPreferences
);

/**
 * @route PUT /api/preferences
 * @desc Update user preferences
 * @access Private
 */
router.put('/',
  preferencesRateLimit,
  authMiddleware.authenticate,
  auditMiddleware.preferencesUpdate,
  auditMiddleware.capture('preferences'),
  preferencesController.updatePreferences,
  auditMiddleware.log
);

/**
 * @route PUT /api/preferences/dashboard
 * @desc Update dashboard layout
 * @access Private
 */
router.put('/dashboard',
  preferencesRateLimit,
  authMiddleware.authenticate,
  auditMiddleware.setAuditInfo('DASHBOARD_LAYOUT_UPDATE', 'DashboardLayout'),
  auditMiddleware.capture('preferences'),
  preferencesController.updateDashboardLayout,
  auditMiddleware.log
);

/**
 * @route PUT /api/preferences/notifications
 * @desc Update notification settings
 * @access Private
 */
router.put('/notifications',
  preferencesRateLimit,
  authMiddleware.authenticate,
  auditMiddleware.setAuditInfo('NOTIFICATION_SETTINGS_UPDATE', 'NotificationSettings'),
  auditMiddleware.capture('preferences'),
  preferencesController.updateNotifications,
  auditMiddleware.log
);

/**
 * @route PUT /api/preferences/privacy
 * @desc Update privacy settings
 * @access Private
 */
router.put('/privacy',
  preferencesRateLimit,
  authMiddleware.authenticate,
  auditMiddleware.setAuditInfo('PRIVACY_SETTINGS_UPDATE', 'PrivacySettings'),
  auditMiddleware.capture('preferences'),
  preferencesController.updatePrivacySettings,
  auditMiddleware.log
);

/**
 * @route PUT /api/preferences/currency
 * @desc Update base currency
 * @access Private
 */
router.put('/currency',
  preferencesRateLimit,
  authMiddleware.authenticate,
  auditMiddleware.setAuditInfo('CURRENCY_UPDATE', 'Currency'),
  auditMiddleware.capture('preferences'),
  preferencesController.updateCurrency,
  auditMiddleware.log
);

/**
 * @route PUT /api/preferences/theme
 * @desc Update theme preference
 * @access Private
 */
router.put('/theme',
  preferencesRateLimit,
  authMiddleware.authenticate,
  auditMiddleware.setAuditInfo('THEME_UPDATE', 'Theme'),
  auditMiddleware.capture('preferences'),
  preferencesController.updateTheme,
  auditMiddleware.log
);

/**
 * @route PUT /api/preferences/risk-tolerance
 * @desc Update risk tolerance
 * @access Private
 */
router.put('/risk-tolerance',
  preferencesRateLimit,
  authMiddleware.authenticate,
  auditMiddleware.setAuditInfo('RISK_TOLERANCE_UPDATE', 'RiskTolerance'),
  auditMiddleware.capture('preferences'),
  preferencesController.updateRiskTolerance,
  auditMiddleware.log
);

/**
 * @route POST /api/preferences/reset
 * @desc Reset preferences to defaults
 * @access Private
 */
router.post('/reset',
  rateLimitService.createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 resets per hour
    message: 'Too many preference resets. Please try again later.'
  }),
  authMiddleware.authenticate,
  auditMiddleware.setAuditInfo('PREFERENCES_RESET', 'UserPreferences'),
  preferencesController.resetPreferences,
  auditMiddleware.log
);

/**
 * @route GET /api/preferences/options
 * @desc Get available preference options
 * @access Private
 */
router.get('/options',
  authMiddleware.authenticate,
  auditMiddleware.skip,
  preferencesController.getPreferenceOptions
);

/**
 * @route POST /api/preferences/import
 * @desc Import preferences from file
 * @access Private
 */
router.post('/import',
  rateLimitService.createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 imports per hour
    message: 'Too many preference imports. Please try again later.'
  }),
  authMiddleware.authenticate,
  auditMiddleware.setAuditInfo('PREFERENCES_IMPORT', 'UserPreferences'),
  preferencesController.importPreferences,
  auditMiddleware.log
);

/**
 * @route GET /api/preferences/export
 * @desc Export preferences
 * @access Private
 */
router.get('/export',
  rateLimitService.createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 exports per hour
    message: 'Too many preference exports. Please try again later.'
  }),
  authMiddleware.authenticate,
  auditMiddleware.setAuditInfo('PREFERENCES_EXPORT', 'UserPreferences'),
  preferencesController.exportPreferences,
  auditMiddleware.log
);

export default router;