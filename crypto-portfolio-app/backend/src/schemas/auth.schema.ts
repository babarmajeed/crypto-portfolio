import { z } from 'zod'
import { emailSchema, passwordSchema, phoneSchema } from './common.schema'

/**
 * User registration schema
 */
export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
  firstName: z
    .string()
    .min(1, 'First name is required')
    .max(50, 'First name must be less than 50 characters')
    .trim(),
  lastName: z
    .string()
    .min(1, 'Last name is required')
    .max(50, 'Last name must be less than 50 characters')
    .trim(),
  phone: phoneSchema,
  acceptTerms: z
    .boolean()
    .refine((val) => val === true, {
      message: 'You must accept the terms and conditions'
    }),
  newsletter: z.boolean().optional().default(false),
  referralCode: z
    .string()
    .optional()
    .refine((code) => {
      if (!code) return true
      return /^[A-Z0-9]{6,12}$/.test(code)
    }, { message: 'Invalid referral code format' })
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword']
})

/**
 * User login schema
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional().default(false),
  captcha: z.string().optional() // For bot protection
})

/**
 * Password reset request schema
 */
export const passwordResetRequestSchema = z.object({
  email: emailSchema,
  captcha: z.string().optional()
})

/**
 * Password reset confirmation schema
 */
export const passwordResetConfirmSchema = z.object({
  token: z
    .string()
    .min(1, 'Reset token is required'),
  password: passwordSchema,
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword']
})

/**
 * Change password schema (for authenticated users)
 */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
  confirmNewPassword: z.string()
}).refine((data) => data.newPassword === data.confirmNewPassword, {
  message: 'New passwords do not match',
  path: ['confirmNewPassword']
}).refine((data) => data.currentPassword !== data.newPassword, {
  message: 'New password must be different from current password',
  path: ['newPassword']
})

/**
 * Email verification schema
 */
export const emailVerificationSchema = z.object({
  token: z
    .string()
    .min(1, 'Verification token is required')
})

/**
 * Resend email verification schema
 */
export const resendVerificationSchema = z.object({
  email: emailSchema
})

/**
 * Two-factor authentication setup schema
 */
export const twoFactorSetupSchema = z.object({
  secret: z
    .string()
    .min(1, 'TOTP secret is required'),
  token: z
    .string()
    .length(6, 'TOTP token must be 6 digits')
    .regex(/^\d{6}$/, 'TOTP token must contain only numbers')
})

/**
 * Two-factor authentication verification schema
 */
export const twoFactorVerifySchema = z.object({
  token: z
    .string()
    .length(6, 'TOTP token must be 6 digits')
    .regex(/^\d{6}$/, 'TOTP token must contain only numbers'),
  rememberDevice: z.boolean().optional().default(false)
})

/**
 * Backup codes verification schema
 */
export const backupCodeVerifySchema = z.object({
  code: z
    .string()
    .length(8, 'Backup code must be 8 characters')
    .regex(/^[A-Z0-9]{8}$/, 'Invalid backup code format')
})

/**
 * OAuth callback schema
 */
export const oauthCallbackSchema = z.object({
  code: z.string().min(1, 'OAuth code is required'),
  state: z.string().optional(),
  error: z.string().optional(),
  error_description: z.string().optional()
}).refine((data) => !data.error, {
  message: 'OAuth authentication failed',
  path: ['error']
})

/**
 * Refresh token schema
 */
export const refreshTokenSchema = z.object({
  refreshToken: z
    .string()
    .min(1, 'Refresh token is required')
})

/**
 * Logout schema
 */
export const logoutSchema = z.object({
  refreshToken: z.string().optional(),
  allDevices: z.boolean().optional().default(false)
})

/**
 * Account deletion schema
 */
export const accountDeletionSchema = z.object({
  password: z.string().min(1, 'Password is required for account deletion'),
  confirmDeletion: z
    .string()
    .refine((val) => val === 'DELETE', {
      message: 'Type "DELETE" to confirm account deletion'
    }),
  reason: z
    .string()
    .max(500, 'Reason must be less than 500 characters')
    .optional(),
  feedback: z
    .string()
    .max(1000, 'Feedback must be less than 1000 characters')
    .optional()
})

/**
 * Session management schema
 */
export const sessionManagementSchema = z.object({
  sessionIds: z
    .array(z.string().uuid())
    .min(1, 'At least one session ID is required'),
  action: z.enum(['terminate', 'extend'], {
    errorMap: () => ({ message: 'Action must be either "terminate" or "extend"' })
  })
})

/**
 * API key authentication schema
 */
export const apiKeyAuthSchema = z.object({
  apiKey: z
    .string()
    .min(32, 'API key too short')
    .max(128, 'API key too long'),
  signature: z.string().optional(), // For request signing
  timestamp: z
    .number()
    .or(z.string().transform(Number))
    .optional()
    .refine((val) => {
      if (!val) return true
      const now = Date.now()
      const timestamp = typeof val === 'string' ? parseInt(val) : val
      return Math.abs(now - timestamp) < 300000 // 5 minutes tolerance
    }, { message: 'Request timestamp too old' })
})

/**
 * Multi-factor authentication challenge schema
 */
export const mfaChallengeSchema = z.object({
  challengeId: z.string().uuid(),
  method: z.enum(['totp', 'sms', 'email', 'backup'], {
    errorMap: () => ({ message: 'Invalid MFA method' })
  }),
  code: z.string().min(1, 'Verification code is required')
})

// Export TypeScript types
export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type PasswordResetRequest = z.infer<typeof passwordResetRequestSchema>
export type PasswordResetConfirm = z.infer<typeof passwordResetConfirmSchema>
export type ChangePassword = z.infer<typeof changePasswordSchema>
export type EmailVerification = z.infer<typeof emailVerificationSchema>
export type TwoFactorSetup = z.infer<typeof twoFactorSetupSchema>
export type TwoFactorVerify = z.infer<typeof twoFactorVerifySchema>
export type BackupCodeVerify = z.infer<typeof backupCodeVerifySchema>
export type OAuthCallback = z.infer<typeof oauthCallbackSchema>
export type RefreshToken = z.infer<typeof refreshTokenSchema>
export type Logout = z.infer<typeof logoutSchema>
export type AccountDeletion = z.infer<typeof accountDeletionSchema>
export type SessionManagement = z.infer<typeof sessionManagementSchema>
export type ApiKeyAuth = z.infer<typeof apiKeyAuthSchema>
export type MfaChallenge = z.infer<typeof mfaChallengeSchema>

export default {
  registerSchema,
  loginSchema,
  passwordResetRequestSchema,
  passwordResetConfirmSchema,
  changePasswordSchema,
  emailVerificationSchema,
  resendVerificationSchema,
  twoFactorSetupSchema,
  twoFactorVerifySchema,
  backupCodeVerifySchema,
  oauthCallbackSchema,
  refreshTokenSchema,
  logoutSchema,
  accountDeletionSchema,
  sessionManagementSchema,
  apiKeyAuthSchema,
  mfaChallengeSchema
}