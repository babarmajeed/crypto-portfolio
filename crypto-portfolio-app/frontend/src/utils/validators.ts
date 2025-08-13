import { z } from 'zod';

// Profile validation schema
export const profileValidationSchema = z.object({
  firstName: z.string()
    .min(1, 'First name is required')
    .max(50, 'First name must be less than 50 characters')
    .regex(/^[a-zA-Z\s'-]+$/, 'First name can only contain letters, spaces, hyphens, and apostrophes'),
  
  lastName: z.string()
    .min(1, 'Last name is required')
    .max(50, 'Last name must be less than 50 characters')
    .regex(/^[a-zA-Z\s'-]+$/, 'Last name can only contain letters, spaces, hyphens, and apostrophes'),
  
  email: z.string()
    .email('Please enter a valid email address')
    .max(255, 'Email address is too long'),
  
  phoneNumber: z.string()
    .optional()
    .or(z.literal(''))
    .refine((val) => {
      if (!val || val === '') return true;
      // Basic international phone number validation
      const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
      return phoneRegex.test(val.replace(/[\s\-\(\)]/g, ''));
    }, 'Please enter a valid phone number'),
  
  bio: z.string()
    .max(500, 'Bio must be less than 500 characters')
    .optional()
    .or(z.literal('')),
  
  timezone: z.string().min(1, 'Please select a timezone'),
  language: z.string().min(1, 'Please select a language'),
  country: z.string().optional().or(z.literal('')),
});

// Preferences validation schema
export const preferencesValidationSchema = z.object({
  baseCurrency: z.string()
    .min(3, 'Currency code must be at least 3 characters')
    .max(3, 'Currency code must be exactly 3 characters')
    .regex(/^[A-Z]{3}$/, 'Currency code must be 3 uppercase letters'),
  
  theme: z.enum(['light', 'dark', 'auto'], {
    errorMap: () => ({ message: 'Theme must be light, dark, or auto' })
  }),
  
  riskTolerance: z.enum(['conservative', 'moderate', 'aggressive'], {
    errorMap: () => ({ message: 'Risk tolerance must be conservative, moderate, or aggressive' })
  }),
  
  language: z.string().min(1, 'Please select a language'),
  timezone: z.string().min(1, 'Please select a timezone'),
  
  dateFormat: z.enum(['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'], {
    errorMap: () => ({ message: 'Please select a valid date format' })
  }),
  
  timeFormat: z.enum(['12h', '24h'], {
    errorMap: () => ({ message: 'Time format must be 12h or 24h' })
  }),
  
  notifications: z.object({
    email: z.boolean(),
    push: z.boolean(),
    sms: z.boolean(),
    marketing: z.boolean(),
    security: z.boolean(),
    portfolio: z.boolean(),
    priceAlerts: z.boolean(),
    newsUpdates: z.boolean(),
  }).optional(),
  
  privacySettings: z.object({
    portfolioPublic: z.boolean(),
    showEmail: z.boolean(),
    allowAnalytics: z.boolean(),
    shareDataWithPartners: z.boolean(),
  }).optional(),
});

// Password validation schema
export const passwordValidationSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters long')
    .max(128, 'Password must be less than 128 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// Avatar upload validation
export const avatarValidationSchema = z.object({
  file: z.instanceof(File)
    .refine((file) => file.size <= 5 * 1024 * 1024, 'File size must be less than 5MB')
    .refine(
      (file) => ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type),
      'File must be a valid image format (JPEG, PNG, GIF, or WebP)'
    ),
  cropData: z.object({
    x: z.number().min(0),
    y: z.number().min(0),
    width: z.number().min(1),
    height: z.number().min(1),
  }).optional(),
});

// Export data validation schema
export const exportDataValidationSchema = z.object({
  format: z.enum(['json', 'csv', 'pdf'], {
    errorMap: () => ({ message: 'Export format must be JSON, CSV, or PDF' })
  }),
  includeTransactions: z.boolean(),
  includePortfolio: z.boolean(),
  includePreferences: z.boolean(),
  includeAuditLogs: z.boolean(),
  dateRange: z.object({
    from: z.date(),
    to: z.date(),
  }).optional().refine((range) => {
    if (!range) return true;
    return range.from <= range.to;
  }, 'Start date must be before or equal to end date'),
});

// Utility validation functions
export const validateEmail = (email: string): boolean => {
  return z.string().email().safeParse(email).success;
};

export const validatePhoneNumber = (phone: string): boolean => {
  if (!phone || phone === '') return true;
  const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
  return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
};

export const validatePassword = (password: string): {
  isValid: boolean;
  errors: string[];
} => {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (password.length > 128) {
    errors.push('Password must be less than 128 characters');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
};

export const validateCurrency = (currency: string): boolean => {
  return /^[A-Z]{3}$/.test(currency);
};

export const validateDateRange = (startDate: Date, endDate: Date): boolean => {
  return startDate <= endDate;
};

export const validateFileSize = (file: File, maxSizeInMB: number): boolean => {
  return file.size <= maxSizeInMB * 1024 * 1024;
};

export const validateImageFile = (file: File): {
  isValid: boolean;
  error?: string;
} => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  
  if (!allowedTypes.includes(file.type)) {
    return {
      isValid: false,
      error: 'File must be a valid image format (JPEG, PNG, GIF, or WebP)',
    };
  }
  
  if (!validateFileSize(file, 5)) {
    return {
      isValid: false,
      error: 'File size must be less than 5MB',
    };
  }
  
  return { isValid: true };
};

// Form validation helper
export const getFieldError = (errors: any, fieldName: string): string | undefined => {
  const error = errors?.[fieldName];
  return error?.message;
};

// Sanitization functions
export const sanitizeString = (input: string): string => {
  return input.trim().replace(/[<>]/g, '');
};

export const sanitizePhoneNumber = (phone: string): string => {
  return phone.replace(/[\s\-\(\)]/g, '');
};

export const formatPhoneNumber = (phone: string): string => {
  const cleaned = sanitizePhoneNumber(phone);
  
  // Simple US phone number formatting
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  
  // International format
  if (cleaned.startsWith('+')) {
    return cleaned;
  }
  
  return phone;
};

export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
};

// Security helpers
export const calculatePasswordStrength = (password: string): {
  score: number;
  level: 'very-weak' | 'weak' | 'fair' | 'good' | 'strong';
  feedback: string[];
} => {
  let score = 0;
  const feedback: string[] = [];
  
  // Length check
  if (password.length >= 8) score += 25;
  else feedback.push('Use at least 8 characters');
  
  if (password.length >= 12) score += 10;
  
  // Character type checks
  if (/[a-z]/.test(password)) score += 15;
  else feedback.push('Include lowercase letters');
  
  if (/[A-Z]/.test(password)) score += 15;
  else feedback.push('Include uppercase letters');
  
  if (/[0-9]/.test(password)) score += 15;
  else feedback.push('Include numbers');
  
  if (/[^A-Za-z0-9]/.test(password)) score += 20;
  else feedback.push('Include special characters');
  
  // Determine level
  let level: 'very-weak' | 'weak' | 'fair' | 'good' | 'strong';
  if (score < 20) level = 'very-weak';
  else if (score < 40) level = 'weak';
  else if (score < 60) level = 'fair';
  else if (score < 80) level = 'good';
  else level = 'strong';
  
  return { score, level, feedback };
};