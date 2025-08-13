# CP-003: User Management and Profiles API Documentation

## Overview

This document provides comprehensive API documentation for the User Management and Profiles system implemented in CP-003.

## Base URL
```
http://localhost:3001/api
```

## Authentication

All endpoints require authentication unless specified otherwise. Include the JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

For sensitive operations, some endpoints may require two-factor authentication via the `X-2FA-Token` header.

## User Profile Management

### Get User Profile

**GET** `/users/profile`

Returns the current user's profile information.

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_id",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "BASIC",
      "isActive": true,
      "isEmailVerified": true,
      "isTwoFactorEnabled": false,
      "lastLogin": "2024-01-01T00:00:00.000Z",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "profile": {
        "firstName": "John",
        "lastName": "Doe",
        "avatarUrl": "https://example.com/avatar.jpg",
        "timezone": "UTC",
        "language": "en",
        "country": "US"
      },
      "preferences": {
        "baseCurrency": "USD",
        "theme": "light",
        "dashboardLayout": {},
        "notifications": {
          "email": true,
          "push": true,
          "sms": false
        },
        "privacySettings": {
          "portfolio_public": false
        },
        "riskTolerance": "moderate"
      }
    }
  }
}
```

### Update User Profile

**PUT** `/users/profile`

Updates the user's profile information.

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "timezone": "America/New_York",
  "language": "en",
  "country": "US"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "profile": {
      "id": "profile_id",
      "userId": "user_id",
      "firstName": "John",
      "lastName": "Doe",
      "avatarUrl": null,
      "timezone": "America/New_York",
      "language": "en",
      "country": "US",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

### Upload Avatar

**POST** `/users/avatar`

Uploads a new avatar image for the user.

**Request:** Multipart form data with `avatar` field containing the image file.

**Supported formats:** JPEG, PNG, WebP (max 5MB)

**Response:**
```json
{
  "success": true,
  "message": "Avatar uploaded successfully",
  "data": {
    "avatarUrl": "https://example.com/avatars/user_id/avatar.jpg"
  }
}
```

### Delete Avatar

**DELETE** `/users/avatar`

Removes the user's current avatar.

**Response:**
```json
{
  "success": true,
  "message": "Avatar deleted successfully",
  "data": {
    "profile": {
      "avatarUrl": null
    }
  }
}
```

## Account Management

### Change Password

**PUT** `/users/password`

Changes the user's password. Requires 2FA if enabled.

**Request Body:**
```json
{
  "currentPassword": "old_password",
  "newPassword": "new_password",
  "confirmPassword": "new_password"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password updated successfully"
}
```

### Change Email

**PUT** `/users/email`

Changes the user's email address. Requires 2FA if enabled.

**Request Body:**
```json
{
  "newEmail": "newemail@example.com",
  "password": "current_password"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Email updated successfully. Please verify your new email address."
}
```

### Delete Account

**DELETE** `/users/account`

Soft deletes the user's account. Requires 2FA if enabled.

**Request Body:**
```json
{
  "password": "current_password",
  "confirmPhrase": "DELETE MY ACCOUNT",
  "reason": "Optional reason for deletion"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Account has been deactivated successfully"
}
```

### Export User Data (GDPR)

**GET** `/users/export`

Exports all user data for GDPR compliance. Requires 2FA if enabled.

**Query Parameters:**
- `format`: `json` (default) or `csv`
- `includePortfolios`: `true` or `false` (default)
- `includeTransactions`: `true` or `false` (default)
- `dateFrom`: ISO date string (optional)
- `dateTo`: ISO date string (optional)

**Response:** Downloads a file containing the user's data.

## User Preferences

### Get Preferences

**GET** `/preferences`

Returns the user's preferences.

**Response:**
```json
{
  "success": true,
  "data": {
    "preferences": {
      "id": "pref_id",
      "userId": "user_id",
      "baseCurrency": "USD",
      "theme": "light",
      "dashboardLayout": {},
      "notifications": {
        "email": true,
        "push": true,
        "sms": false,
        "priceAlerts": true,
        "portfolioUpdates": true,
        "newsUpdates": false,
        "marketAlerts": true
      },
      "privacySettings": {
        "portfolio_public": false,
        "show_balances": true,
        "data_sharing": false,
        "analytics_tracking": true,
        "marketing_emails": false
      },
      "riskTolerance": "moderate",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

### Update Preferences

**PUT** `/preferences`

Updates user preferences.

**Request Body:**
```json
{
  "baseCurrency": "EUR",
  "theme": "dark",
  "dashboardLayout": {
    "widgets": [
      {
        "id": "portfolio-summary",
        "type": "summary",
        "position": { "x": 0, "y": 0 },
        "size": { "width": 6, "height": 4 }
      }
    ]
  },
  "notifications": {
    "email": true,
    "push": false,
    "sms": false,
    "priceAlerts": true,
    "portfolioUpdates": true,
    "newsUpdates": false,
    "marketAlerts": false
  },
  "privacySettings": {
    "portfolio_public": false,
    "show_balances": true,
    "data_sharing": false
  },
  "riskTolerance": "aggressive"
}
```

### Update Specific Preference Categories

**PUT** `/preferences/dashboard` - Update dashboard layout
**PUT** `/preferences/notifications` - Update notification settings
**PUT** `/preferences/privacy` - Update privacy settings
**PUT** `/preferences/currency` - Update base currency
**PUT** `/preferences/theme` - Update theme
**PUT** `/preferences/risk-tolerance` - Update risk tolerance

### Get Preference Options

**GET** `/preferences/options`

Returns available options for preferences.

**Response:**
```json
{
  "success": true,
  "data": {
    "options": {
      "themes": ["light", "dark", "auto"],
      "currencies": ["USD", "EUR", "GBP", "BTC", "ETH"],
      "riskTolerances": [
        {
          "value": "conservative",
          "label": "Conservative",
          "description": "Low risk, steady returns"
        }
      ],
      "timezones": ["UTC", "America/New_York"],
      "languages": [
        { "code": "en", "name": "English" }
      ],
      "countries": ["US", "CA", "GB"]
    }
  }
}
```

## Security Management

### Get Security Overview

**GET** `/security/overview`

Returns security overview including trusted devices and recent activity.

**Response:**
```json
{
  "success": true,
  "data": {
    "security": {
      "twoFactorEnabled": false,
      "trustedDevicesCount": 2,
      "recentLoginAttempts": 0,
      "passwordLastChanged": "2024-01-01T00:00:00.000Z"
    },
    "trustedDevices": [
      {
        "id": "device_id",
        "deviceFingerprint": "hash",
        "deviceName": "Chrome Browser",
        "lastSeen": "2024-01-01T00:00:00.000Z",
        "trustedAt": "2024-01-01T00:00:00.000Z",
        "isCurrentDevice": true
      }
    ],
    "recentActivity": [
      {
        "id": "log_id",
        "action": "LOGIN",
        "resource": "Authentication",
        "createdAt": "2024-01-01T00:00:00.000Z",
        "ipAddress": "192.168.1.1"
      }
    ]
  }
}
```

### Get Audit Logs

**GET** `/security/audit-logs`

Returns paginated audit logs with optional filtering.

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 50, max: 100)
- `action`: Filter by action (optional)
- `resource`: Filter by resource (optional)
- `dateFrom`: Filter from date (ISO string, optional)
- `dateTo`: Filter to date (ISO string, optional)
- `sortBy`: Sort field (default: 'createdAt')
- `sortOrder`: Sort order ('asc' or 'desc', default: 'desc')

**Response:**
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": "log_id",
        "action": "PROFILE_UPDATE",
        "resource": "UserProfile",
        "resourceId": "profile_id",
        "ipAddress": "192.168.1.1",
        "userAgent": "Mozilla/5.0...",
        "createdAt": "2024-01-01T00:00:00.000Z",
        "changes": {
          "old": { "firstName": "John" },
          "new": { "firstName": "Johnny" }
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 150,
      "totalPages": 3
    }
  }
}
```

### Get Security Events

**GET** `/security/events`

Returns security-related events (filtered audit logs).

**Query Parameters:** Same as audit logs.

### Manage Trusted Devices

**POST** `/security/devices`

Manage trusted devices (trust, remove, list).

**Request Body:**
```json
{
  "action": "trust",
  "deviceFingerprint": "device_hash",
  "deviceName": "My iPhone"
}
```

**Actions:**
- `list`: List all trusted devices
- `trust`: Add a device to trusted devices
- `remove`: Remove a device from trusted devices

### Trust Current Device

**POST** `/security/devices/trust-current`

Adds the current device to trusted devices.

**Request Body:**
```json
{
  "deviceName": "My Laptop"
}
```

### Remove Trusted Device

**DELETE** `/security/devices/:deviceId`

Removes a specific trusted device by ID.

### Check Device Trust Status

**GET** `/security/devices/check`

Checks if the current device is trusted.

**Response:**
```json
{
  "success": true,
  "data": {
    "deviceFingerprint": "hash",
    "isTrusted": true,
    "deviceName": "Chrome Browser"
  }
}
```

## Error Responses

All endpoints may return these common error responses:

### 400 Bad Request
```json
{
  "error": "Validation failed",
  "details": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

### 401 Unauthorized
```json
{
  "error": "Access token required"
}
```

### 403 Forbidden
```json
{
  "error": "Insufficient permissions"
}
```

### 404 Not Found
```json
{
  "error": "User not found"
}
```

### 429 Too Many Requests
```json
{
  "error": "Too many requests. Please try again later."
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error"
}
```

## Rate Limiting

Different endpoints have different rate limits:

- **General operations**: 60 requests per minute
- **Preference updates**: 10 requests per minute
- **File uploads**: 3 requests per minute
- **Sensitive operations**: 5 requests per 15 minutes
- **Password/email changes**: 5 requests per 15 minutes
- **Data exports**: 2 requests per hour
- **Device management**: 10 requests per 15 minutes

## Security Features

### Audit Logging
All user actions are automatically logged with:
- User ID
- Action performed
- Resource affected
- IP address
- User agent
- Before/after values for updates

### Device Fingerprinting
Trusted devices are identified using:
- User agent string
- IP address
- Accept-Language header
- Accept-Encoding header

### Two-Factor Authentication
Sensitive operations require 2FA token in `X-2FA-Token` header when enabled.

### File Upload Security
- File type validation (JPEG, PNG, WebP only)
- File size limits (5MB max)
- Image processing and validation
- Virus scanning (in production)
- Cloud storage with proper access controls

## GDPR Compliance

The system provides:
- Complete data export functionality
- Data anonymization on account deletion
- Audit trail of all data access
- Right to be forgotten implementation
- Privacy settings management
- Consent tracking for data processing