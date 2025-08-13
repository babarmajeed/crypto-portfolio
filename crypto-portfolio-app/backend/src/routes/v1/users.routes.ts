import { Router } from 'express'
import { userController } from '@/controllers/userController'
import { authMiddleware } from '@/middleware/authMiddleware'
import { validate } from '@/middleware/validation.middleware'
import { 
  updateProfileSchema,
  updatePreferencesSchema,
  changePasswordSchema,
  deleteAccountSchema
} from '@/schemas/user.schema'

const router = Router()

// Apply authentication to all user routes
router.use(authMiddleware.authenticate)

/**
 * @swagger
 * /users/profile:
 *   get:
 *     tags: [Users]
 *     summary: Get user profile
 *     description: Retrieve current user's profile information
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/profile', userController.getProfile)

/**
 * @swagger
 * /users/profile:
 *   put:
 *     tags: [Users]
 *     summary: Update user profile
 *     description: Update current user's profile information
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *                 example: John
 *               lastName:
 *                 type: string
 *                 example: Doe
 *               phoneNumber:
 *                 type: string
 *                 example: "+1234567890"
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *                 example: "1990-01-01"
 *               country:
 *                 type: string
 *                 example: "United States"
 *               timezone:
 *                 type: string
 *                 example: "America/New_York"
 *               bio:
 *                 type: string
 *                 maxLength: 500
 *                 example: "Crypto enthusiast and portfolio manager"
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Profile updated successfully
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.put('/profile', validate(updateProfileSchema), userController.updateProfile)

/**
 * @swagger
 * /users/preferences:
 *   get:
 *     tags: [Users]
 *     summary: Get user preferences
 *     description: Retrieve current user's preferences and settings
 *     responses:
 *       200:
 *         description: Preferences retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     currency:
 *                       type: string
 *                       example: "USD"
 *                     language:
 *                       type: string
 *                       example: "en"
 *                     theme:
 *                       type: string
 *                       enum: [light, dark, auto]
 *                       example: "dark"
 *                     notifications:
 *                       type: object
 *                       properties:
 *                         email:
 *                           type: boolean
 *                         push:
 *                           type: boolean
 *                         priceAlerts:
 *                           type: boolean
 *                         portfolioUpdates:
 *                           type: boolean
 *                     privacy:
 *                       type: object
 *                       properties:
 *                         profileVisibility:
 *                           type: string
 *                           enum: [public, private, friends]
 *                         sharePortfolio:
 *                           type: boolean
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/preferences', userController.getPreferences)

/**
 * @swagger
 * /users/preferences:
 *   put:
 *     tags: [Users]
 *     summary: Update user preferences
 *     description: Update current user's preferences and settings
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               currency:
 *                 type: string
 *                 example: "USD"
 *               language:
 *                 type: string
 *                 example: "en"
 *               theme:
 *                 type: string
 *                 enum: [light, dark, auto]
 *                 example: "dark"
 *               notifications:
 *                 type: object
 *                 properties:
 *                   email:
 *                     type: boolean
 *                   push:
 *                     type: boolean
 *                   priceAlerts:
 *                     type: boolean
 *                   portfolioUpdates:
 *                     type: boolean
 *               privacy:
 *                 type: object
 *                 properties:
 *                   profileVisibility:
 *                     type: string
 *                     enum: [public, private, friends]
 *                   sharePortfolio:
 *                     type: boolean
 *     responses:
 *       200:
 *         description: Preferences updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Preferences updated successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.put('/preferences', validate(updatePreferencesSchema), userController.updatePreferences)

/**
 * @swagger
 * /users/change-password:
 *   post:
 *     tags: [Users]
 *     summary: Change password
 *     description: Change current user's password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 example: "CurrentPassword123!"
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *                 example: "NewSecurePassword123!"
 *     responses:
 *       200:
 *         description: Password changed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Password changed successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/change-password', validate(changePasswordSchema), userController.changePassword)

/**
 * @swagger
 * /users/sessions:
 *   get:
 *     tags: [Users]
 *     summary: Get active sessions
 *     description: Retrieve list of user's active sessions
 *     responses:
 *       200:
 *         description: Active sessions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       deviceType:
 *                         type: string
 *                         example: "desktop"
 *                       browser:
 *                         type: string
 *                         example: "Chrome"
 *                       location:
 *                         type: string
 *                         example: "New York, US"
 *                       ipAddress:
 *                         type: string
 *                         example: "192.168.1.1"
 *                       lastActive:
 *                         type: string
 *                         format: date-time
 *                       current:
 *                         type: boolean
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/sessions', userController.getSessions)

/**
 * @swagger
 * /users/sessions/{sessionId}:
 *   delete:
 *     tags: [Users]
 *     summary: Revoke session
 *     description: Revoke a specific user session
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Session ID to revoke
 *     responses:
 *       200:
 *         description: Session revoked successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Session revoked successfully
 *       400:
 *         description: Cannot revoke current session
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Session not found
 */
router.delete('/sessions/:sessionId', userController.revokeSession)

/**
 * @swagger
 * /users/sessions:
 *   delete:
 *     tags: [Users]
 *     summary: Revoke all sessions
 *     description: Revoke all user sessions except current one
 *     responses:
 *       200:
 *         description: All sessions revoked successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: All sessions revoked successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     revokedCount:
 *                       type: number
 *                       example: 3
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.delete('/sessions', userController.revokeAllSessions)

/**
 * @swagger
 * /users/account:
 *   delete:
 *     tags: [Users]
 *     summary: Delete user account
 *     description: Permanently delete user account and all associated data
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *               - confirmation
 *             properties:
 *               password:
 *                 type: string
 *                 example: "CurrentPassword123!"
 *               confirmation:
 *                 type: string
 *                 enum: ["DELETE_MY_ACCOUNT"]
 *                 example: "DELETE_MY_ACCOUNT"
 *               reason:
 *                 type: string
 *                 example: "No longer needed"
 *     responses:
 *       200:
 *         description: Account deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Account deleted successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.delete('/account', validate(deleteAccountSchema), userController.deleteAccount)

/**
 * @swagger
 * /users/export:
 *   get:
 *     tags: [Users]
 *     summary: Export user data
 *     description: Export all user data in JSON format (GDPR compliance)
 *     responses:
 *       200:
 *         description: User data exported successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     portfolios:
 *                       type: array
 *                       items:
 *                         type: object
 *                     transactions:
 *                       type: array
 *                       items:
 *                         type: object
 *                     preferences:
 *                       type: object
 *                     exportedAt:
 *                       type: string
 *                       format: date-time
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/export', userController.exportData)

export default router