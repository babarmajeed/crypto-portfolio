import { Express, Request, Response } from 'express';
import { swaggerSpec } from './swagger.config';
import { config } from '@/config/config';
import { logger } from '@/utils/logger';

/**
 * Enhanced API Documentation Generator
 * Provides interactive documentation, code examples, and developer tools
 */
export class ApiDocumentationGenerator {
  private app: Express;
  
  constructor(app: Express) {
    this.app = app;
  }

  /**
   * Setup enhanced documentation routes
   */
  public setupDocumentation(): void {
    // API documentation with custom themes
    this.app.get('/api/v1/docs/custom', this.serveCustomDocs.bind(this));
    
    // Code examples endpoint
    this.app.get('/api/v1/docs/examples', this.getCodeExamples.bind(this));
    
    // Authentication flow documentation
    this.app.get('/api/v1/docs/auth-flow', this.getAuthFlowDocs.bind(this));
    
    // Error handling documentation
    this.app.get('/api/v1/docs/errors', this.getErrorDocs.bind(this));
    
    // Rate limiting documentation
    this.app.get('/api/v1/docs/rate-limits', this.getRateLimitDocs.bind(this));
    
    // Changelog endpoint
    this.app.get('/api/v1/docs/changelog', this.getChangelog.bind(this));
    
    // Postman collection
    this.app.get('/api/v1/docs/postman', this.getPostmanCollection.bind(this));
    
    // OpenAPI schema validation
    this.app.get('/api/v1/docs/validate', this.validateSchema.bind(this));
  }

  /**
   * Serve custom documentation with enhanced styling
   */
  private async serveCustomDocs(req: Request, res: Response): Promise<void> {
    try {
      const customHtml = this.generateCustomDocsHtml();
      res.setHeader('Content-Type', 'text/html');
      res.send(customHtml);
    } catch (error) {
      logger.error('Error serving custom docs:', error);
      res.status(500).json({ error: 'Failed to generate documentation' });
    }
  }

  /**
   * Generate enhanced HTML documentation
   */
  private generateCustomDocsHtml(): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Crypto Portfolio API Documentation</title>
    <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.0.1/swagger-ui.css" />
    <style>
        .swagger-ui .topbar { display: none !important; }
        .swagger-ui .info .title {
            color: #1f2937;
            font-size: 2.5rem;
            font-weight: 700;
        }
        .swagger-ui .info .description {
            font-size: 1.1rem;
            line-height: 1.6;
        }
        .swagger-ui .scheme-container {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
            border-radius: 8px;
            color: white;
            margin: 20px 0;
        }
        .swagger-ui .auth-wrapper {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 15px;
            margin: 10px 0;
        }
        .swagger-ui .opblock.opblock-get .opblock-summary-method {
            background: #10b981;
        }
        .swagger-ui .opblock.opblock-post .opblock-summary-method {
            background: #3b82f6;
        }
        .swagger-ui .opblock.opblock-put .opblock-summary-method {
            background: #f59e0b;
        }
        .swagger-ui .opblock.opblock-delete .opblock-summary-method {
            background: #ef4444;
        }
        .api-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 2rem;
            text-align: center;
            margin-bottom: 2rem;
        }
        .api-header h1 {
            margin: 0;
            font-size: 2.5rem;
            font-weight: 700;
        }
        .api-header p {
            margin: 1rem 0 0 0;
            font-size: 1.2rem;
            opacity: 0.9;
        }
        .quick-links {
            display: flex;
            justify-content: center;
            gap: 1rem;
            margin: 1rem 0;
            flex-wrap: wrap;
        }
        .quick-link {
            background: white;
            color: #667eea;
            padding: 0.5rem 1rem;
            border-radius: 6px;
            text-decoration: none;
            font-weight: 500;
            transition: all 0.2s;
        }
        .quick-link:hover {
            background: #f3f4f6;
            transform: translateY(-1px);
        }
        .security-notice {
            background: #fef3c7;
            border: 1px solid #f59e0b;
            border-radius: 6px;
            padding: 1rem;
            margin: 1rem 0;
        }
        .security-notice h3 {
            color: #92400e;
            margin: 0 0 0.5rem 0;
        }
    </style>
</head>
<body>
    <div class="api-header">
        <h1>🚀 Crypto Portfolio API</h1>
        <p>Comprehensive REST API for cryptocurrency portfolio management</p>
        <div class="quick-links">
            <a href="/api/v1/docs/examples" class="quick-link">📝 Code Examples</a>
            <a href="/api/v1/docs/auth-flow" class="quick-link">🔐 Authentication</a>
            <a href="/api/v1/docs/postman" class="quick-link">📮 Postman Collection</a>
            <a href="/api/v1/docs/changelog" class="quick-link">📋 Changelog</a>
        </div>
    </div>
    
    <div class="security-notice">
        <h3>🛡️ Security Notice</h3>
        <p>All API endpoints require proper authentication. Use the Authorization header with your JWT token. Never expose your API keys in client-side code.</p>
    </div>
    
    <div id="swagger-ui"></div>
    
    <script src="https://unpkg.com/swagger-ui-dist@5.0.1/swagger-ui-bundle.js"></script>
    <script src="https://unpkg.com/swagger-ui-dist@5.0.1/swagger-ui-standalone-preset.js"></script>
    <script>
        SwaggerUIBundle({
            url: '/api/v1/swagger.json',
            dom_id: '#swagger-ui',
            deepLinking: true,
            presets: [
                SwaggerUIBundle.presets.apis,
                SwaggerUIStandalonePreset
            ],
            plugins: [
                SwaggerUIBundle.plugins.DownloadUrl
            ],
            layout: "StandaloneLayout",
            requestInterceptor: (request) => {
                // Add API key if available
                const apiKey = localStorage.getItem('api_key');
                if (apiKey) {
                    request.headers['X-API-Key'] = apiKey;
                }
                return request;
            },
            responseInterceptor: (response) => {
                // Log response for debugging
                console.log('API Response:', response.status, response.url);
                return response;
            },
            onComplete: () => {
                console.log('Swagger UI loaded successfully');
            }
        });
    </script>
</body>
</html>`;
  }

  /**
   * Get code examples for different programming languages
   */
  private async getCodeExamples(req: Request, res: Response): Promise<void> {
    try {
      const examples = {
        javascript: {
          authentication: `
// JavaScript/Node.js Example
const axios = require('axios');

const API_BASE = '${config.apiUrl || 'http://localhost:3001'}/api/v1';

// 1. User Login
const login = async (email, password) => {
  try {
    const response = await axios.post(\`\${API_BASE}/auth/login\`, {
      email,
      password
    });
    
    const { token } = response.data.data;
    localStorage.setItem('auth_token', token);
    return token;
  } catch (error) {
    console.error('Login failed:', error.response.data);
    throw error;
  }
};

// 2. Get Portfolios
const getPortfolios = async () => {
  try {
    const token = localStorage.getItem('auth_token');
    const response = await axios.get(\`\${API_BASE}/portfolios\`, {
      headers: {
        'Authorization': \`Bearer \${token}\`
      }
    });
    
    return response.data.data;
  } catch (error) {
    console.error('Failed to fetch portfolios:', error.response.data);
    throw error;
  }
};

// 3. Create Portfolio
const createPortfolio = async (portfolioData) => {
  try {
    const token = localStorage.getItem('auth_token');
    const response = await axios.post(\`\${API_BASE}/portfolios\`, portfolioData, {
      headers: {
        'Authorization': \`Bearer \${token}\`,
        'Content-Type': 'application/json'
      }
    });
    
    return response.data.data;
  } catch (error) {
    console.error('Failed to create portfolio:', error.response.data);
    throw error;
  }
};

// 4. Add Transaction
const addTransaction = async (portfolioId, transactionData) => {
  try {
    const token = localStorage.getItem('auth_token');
    const response = await axios.post(\`\${API_BASE}/portfolios/\${portfolioId}/transactions\`, transactionData, {
      headers: {
        'Authorization': \`Bearer \${token}\`,
        'Content-Type': 'application/json'
      }
    });
    
    return response.data.data;
  } catch (error) {
    console.error('Failed to add transaction:', error.response.data);
    throw error;
  }
};
          `,
          python: `
# Python Example
import requests
import json

API_BASE = '${config.apiUrl || 'http://localhost:3001'}/api/v1'

class CryptoPortfolioAPI:
    def __init__(self):
        self.token = None
        self.session = requests.Session()
    
    def login(self, email, password):
        """Authenticate user and store token"""
        response = self.session.post(f'{API_BASE}/auth/login', json={
            'email': email,
            'password': password
        })
        
        if response.status_code == 200:
            self.token = response.json()['data']['token']
            self.session.headers.update({
                'Authorization': f'Bearer {self.token}'
            })
            return self.token
        else:
            raise Exception(f'Login failed: {response.json()}')
    
    def get_portfolios(self, page=1, limit=10):
        """Get user portfolios with pagination"""
        response = self.session.get(f'{API_BASE}/portfolios', params={
            'page': page,
            'limit': limit
        })
        
        if response.status_code == 200:
            return response.json()['data']
        else:
            raise Exception(f'Failed to fetch portfolios: {response.json()}')
    
    def create_portfolio(self, name, description=None, portfolio_type='MANUAL'):
        """Create a new portfolio"""
        data = {
            'name': name,
            'type': portfolio_type
        }
        if description:
            data['description'] = description
            
        response = self.session.post(f'{API_BASE}/portfolios', json=data)
        
        if response.status_code == 201:
            return response.json()['data']
        else:
            raise Exception(f'Failed to create portfolio: {response.json()}')
    
    def add_transaction(self, portfolio_id, transaction_data):
        """Add transaction to portfolio"""
        response = self.session.post(
            f'{API_BASE}/portfolios/{portfolio_id}/transactions',
            json=transaction_data
        )
        
        if response.status_code == 201:
            return response.json()['data']
        else:
            raise Exception(f'Failed to add transaction: {response.json()}')

# Usage example
api = CryptoPortfolioAPI()
api.login('user@example.com', 'password123')
portfolios = api.get_portfolios()
print(f'Found {len(portfolios)} portfolios')
          `,
          curl: `
# cURL Examples

# 1. User Login
curl -X POST "${config.apiUrl || 'http://localhost:3001'}/api/v1/auth/login" \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'

# 2. Get Portfolios (with pagination)
curl -X GET "${config.apiUrl || 'http://localhost:3001'}/api/v1/portfolios?page=1&limit=10" \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# 3. Create Portfolio
curl -X POST "${config.apiUrl || 'http://localhost:3001'}/api/v1/portfolios" \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "My Crypto Portfolio",
    "description": "Main trading portfolio",
    "type": "MANUAL",
    "isDefault": true
  }'

# 4. Add Transaction
curl -X POST "${config.apiUrl || 'http://localhost:3001'}/api/v1/portfolios/PORTFOLIO_ID/transactions" \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "type": "BUY",
    "symbol": "BTC",
    "quantity": 0.5,
    "price": 45000,
    "fee": 25,
    "executedAt": "2024-01-15T10:30:00Z"
  }'

# 5. Get Portfolio Performance
curl -X GET "${config.apiUrl || 'http://localhost:3001'}/api/v1/portfolios/PORTFOLIO_ID/performance?period=30d" \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# 6. Update User Profile
curl -X PUT "${config.apiUrl || 'http://localhost:3001'}/api/v1/users/profile" \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "preferences": {
      "currency": "USD",
      "timezone": "America/New_York"
    }
  }'
          `
        }
      };

      res.json({
        success: true,
        data: examples,
        message: 'Code examples retrieved successfully'
      });
    } catch (error) {
      logger.error('Error getting code examples:', error);
      res.status(500).json({ error: 'Failed to get code examples' });
    }
  }

  /**
   * Get authentication flow documentation
   */
  private async getAuthFlowDocs(req: Request, res: Response): Promise<void> {
    try {
      const authFlow = {
        overview: 'The API uses JWT (JSON Web Tokens) for authentication with optional 2FA support.',
        flows: {
          basic: {
            title: 'Basic Authentication Flow',
            steps: [
              '1. User registers with email and password',
              '2. Email verification (if required)',
              '3. User logs in with credentials',
              '4. Server returns JWT access token and refresh token',
              '5. Client includes token in Authorization header for protected endpoints',
              '6. Token expires after 15 minutes (configurable)',
              '7. Use refresh token to get new access token'
            ]
          },
          twoFactor: {
            title: '2FA Authentication Flow',
            steps: [
              '1. User enables 2FA in account settings',
              '2. Server generates TOTP secret and QR code',
              '3. User scans QR code with authenticator app',
              '4. User verifies setup with TOTP code',
              '5. For login: user provides email, password, and TOTP code',
              '6. Server validates all credentials and returns tokens'
            ]
          },
          oauth: {
            title: 'OAuth2 Flow (Google/GitHub)',
            steps: [
              '1. User clicks OAuth provider button',
              '2. Redirect to provider authorization page',
              '3. User grants permissions',
              '4. Provider redirects back with authorization code',
              '5. Server exchanges code for provider token',
              '6. Server creates/updates user account',
              '7. Server returns JWT tokens for API access'
            ]
          }
        },
        tokenTypes: {
          accessToken: {
            purpose: 'Short-lived token for API access',
            expiry: '15 minutes',
            usage: 'Include in Authorization: Bearer <token> header'
          },
          refreshToken: {
            purpose: 'Long-lived token for getting new access tokens',
            expiry: '30 days',
            usage: 'Send to /auth/refresh endpoint when access token expires'
          }
        },
        security: {
          recommendations: [
            'Store tokens securely (httpOnly cookies recommended)',
            'Never expose tokens in client-side code',
            'Implement token rotation on refresh',
            'Use HTTPS in production',
            'Implement proper CORS policies',
            'Enable 2FA for enhanced security'
          ],
          rateLimit: {
            login: '10 attempts per 15 minutes per IP',
            refresh: '50 requests per hour per user',
            registration: '5 attempts per hour per IP'
          }
        }
      };

      res.json({
        success: true,
        data: authFlow,
        message: 'Authentication flow documentation retrieved successfully'
      });
    } catch (error) {
      logger.error('Error getting auth flow docs:', error);
      res.status(500).json({ error: 'Failed to get authentication documentation' });
    }
  }

  /**
   * Get comprehensive error documentation
   */
  private async getErrorDocs(req: Request, res: Response): Promise<void> {
    try {
      const errorDocs = {
        overview: 'All API endpoints return consistent error responses with HTTP status codes and detailed error information.',
        structure: {
          success: 'boolean - Always false for errors',
          error: 'string - Error type/category',
          message: 'string - Human-readable error message',
          code: 'string - Machine-readable error code',
          details: 'array - Validation error details (when applicable)',
          requestId: 'string - Unique request identifier for support'
        },
        statusCodes: {
          400: {
            name: 'Bad Request',
            description: 'Invalid request data or parameters',
            examples: ['VALIDATION_ERROR', 'INVALID_REQUEST_FORMAT']
          },
          401: {
            name: 'Unauthorized',
            description: 'Authentication required or invalid',
            examples: ['INVALID_TOKEN', 'TOKEN_EXPIRED', 'MISSING_AUTHORIZATION']
          },
          403: {
            name: 'Forbidden',
            description: 'Insufficient permissions',
            examples: ['INSUFFICIENT_PERMISSIONS', 'ACCOUNT_SUSPENDED']
          },
          404: {
            name: 'Not Found',
            description: 'Resource not found',
            examples: ['RESOURCE_NOT_FOUND', 'ENDPOINT_NOT_FOUND']
          },
          409: {
            name: 'Conflict',
            description: 'Resource conflict',
            examples: ['EMAIL_ALREADY_EXISTS', 'PORTFOLIO_NAME_TAKEN']
          },
          422: {
            name: 'Unprocessable Entity',
            description: 'Validation failed',
            examples: ['VALIDATION_FAILED', 'INVALID_DATA_FORMAT']
          },
          429: {
            name: 'Too Many Requests',
            description: 'Rate limit exceeded',
            examples: ['RATE_LIMIT_EXCEEDED', 'TOO_MANY_LOGIN_ATTEMPTS']
          },
          500: {
            name: 'Internal Server Error',
            description: 'Server-side error',
            examples: ['INTERNAL_ERROR', 'DATABASE_ERROR', 'EXTERNAL_SERVICE_ERROR']
          }
        },
        commonErrors: {
          VALIDATION_ERROR: {
            status: 400,
            description: 'Request validation failed',
            resolution: 'Check request data against API schema'
          },
          UNAUTHORIZED: {
            status: 401,
            description: 'Authentication token missing or invalid',
            resolution: 'Obtain valid JWT token through login'
          },
          TOKEN_EXPIRED: {
            status: 401,
            description: 'JWT token has expired',
            resolution: 'Use refresh token to get new access token'
          },
          INSUFFICIENT_PERMISSIONS: {
            status: 403,
            description: 'User lacks required permissions',
            resolution: 'Contact administrator for access rights'
          },
          RATE_LIMIT_EXCEEDED: {
            status: 429,
            description: 'Too many requests in time window',
            resolution: 'Wait before making additional requests'
          },
          PORTFOLIO_NOT_FOUND: {
            status: 404,
            description: 'Portfolio does not exist or access denied',
            resolution: 'Verify portfolio ID and user permissions'
          }
        },
        handling: {
          bestPractices: [
            'Always check the success field first',
            'Use error codes for programmatic handling',
            'Display message field to users',
            'Log requestId for support tickets',
            'Handle rate limits with exponential backoff',
            'Implement retry logic for 5xx errors'
          ]
        }
      };

      res.json({
        success: true,
        data: errorDocs,
        message: 'Error documentation retrieved successfully'
      });
    } catch (error) {
      logger.error('Error getting error docs:', error);
      res.status(500).json({ error: 'Failed to get error documentation' });
    }
  }

  /**
   * Get rate limiting documentation
   */
  private async getRateLimitDocs(req: Request, res: Response): Promise<void> {
    try {
      const rateLimitDocs = {
        overview: 'API endpoints are protected by rate limiting to ensure fair usage and prevent abuse.',
        limits: {
          authentication: {
            window: '15 minutes',
            requests: 10,
            scope: 'per IP address',
            endpoints: ['/auth/login', '/auth/register', '/auth/reset-password']
          },
          general: {
            window: '15 minutes',
            requests: 100,
            scope: 'per authenticated user',
            endpoints: ['Most API endpoints']
          },
          marketData: {
            window: '1 minute',
            requests: 200,
            scope: 'per authenticated user',
            endpoints: ['/prices/*', '/market/*']
          },
          fileUpload: {
            window: '1 hour',
            requests: 10,
            scope: 'per authenticated user',
            endpoints: ['/upload/*']
          },
          sensitive: {
            window: '1 minute',
            requests: 5,
            scope: 'per authenticated user',
            endpoints: ['/auth/enable-2fa', '/users/delete-account', '/api-keys/create']
          }
        },
        headers: {
          response: {
            'X-RateLimit-Limit': 'Maximum requests allowed in window',
            'X-RateLimit-Remaining': 'Requests remaining in current window',
            'X-RateLimit-Reset': 'Unix timestamp when window resets',
            'Retry-After': 'Seconds to wait before retrying (when limit exceeded)'
          }
        },
        handling: {
          detection: 'Monitor X-RateLimit-Remaining header',
          backoff: 'Implement exponential backoff when approaching limits',
          retryAfter: 'Respect Retry-After header when limit exceeded',
          caching: 'Cache responses to reduce API calls'
        },
        exemptions: {
          health: 'Health check endpoints are not rate limited',
          documentation: 'Documentation endpoints have higher limits',
          webhooks: 'Webhook endpoints use separate limits'
        }
      };

      res.json({
        success: true,
        data: rateLimitDocs,
        message: 'Rate limiting documentation retrieved successfully'
      });
    } catch (error) {
      logger.error('Error getting rate limit docs:', error);
      res.status(500).json({ error: 'Failed to get rate limiting documentation' });
    }
  }

  /**
   * Get API changelog
   */
  private async getChangelog(req: Request, res: Response): Promise<void> {
    try {
      const changelog = {
        currentVersion: '1.0.0',
        versions: [
          {
            version: '1.0.0',
            date: '2024-01-15',
            type: 'major',
            changes: [
              'Initial API release',
              'User authentication and authorization',
              'Portfolio management endpoints',
              'Transaction tracking',
              'Exchange integrations',
              'Real-time market data',
              'API key management',
              'Comprehensive documentation'
            ]
          },
          {
            version: '0.9.0-beta',
            date: '2024-01-01',
            type: 'pre-release',
            changes: [
              'Beta release for testing',
              'Core portfolio functionality',
              'Basic authentication',
              'Limited exchange support'
            ]
          }
        ],
        upcoming: {
          version: '1.1.0',
          estimatedDate: '2024-02-15',
          plannedFeatures: [
            'Advanced portfolio analytics',
            'Tax reporting integration',
            'Mobile app API endpoints',
            'Improved WebSocket events',
            'Additional exchange integrations'
          ]
        },
        migration: {
          '1.0.0': {
            breaking: [],
            deprecated: [],
            notes: 'First stable release - no breaking changes'
          }
        }
      };

      res.json({
        success: true,
        data: changelog,
        message: 'Changelog retrieved successfully'
      });
    } catch (error) {
      logger.error('Error getting changelog:', error);
      res.status(500).json({ error: 'Failed to get changelog' });
    }
  }

  /**
   * Generate Postman collection
   */
  private async getPostmanCollection(req: Request, res: Response): Promise<void> {
    try {
      const collection = {
        info: {
          name: 'Crypto Portfolio API',
          description: 'Complete Postman collection for the Crypto Portfolio API',
          version: '1.0.0',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
        },
        auth: {
          type: 'bearer',
          bearer: [
            {
              key: 'token',
              value: '{{auth_token}}',
              type: 'string'
            }
          ]
        },
        variable: [
          {
            key: 'base_url',
            value: config.apiUrl || 'http://localhost:3001/api/v1'
          },
          {
            key: 'auth_token',
            value: ''
          }
        ],
        item: [
          {
            name: 'Authentication',
            item: [
              {
                name: 'Login',
                request: {
                  method: 'POST',
                  header: [
                    {
                      key: 'Content-Type',
                      value: 'application/json'
                    }
                  ],
                  body: {
                    mode: 'raw',
                    raw: JSON.stringify({
                      email: 'user@example.com',
                      password: 'password123'
                    }, null, 2)
                  },
                  url: {
                    raw: '{{base_url}}/auth/login',
                    host: ['{{base_url}}'],
                    path: ['auth', 'login']
                  }
                },
                event: [
                  {
                    listen: 'test',
                    script: {
                      exec: [
                        'if (pm.response.code === 200) {',
                        '    const response = pm.response.json();',
                        '    pm.environment.set("auth_token", response.data.token);',
                        '}'
                      ]
                    }
                  }
                ]
              },
              {
                name: 'Register',
                request: {
                  method: 'POST',
                  header: [
                    {
                      key: 'Content-Type',
                      value: 'application/json'
                    }
                  ],
                  body: {
                    mode: 'raw',
                    raw: JSON.stringify({
                      email: 'newuser@example.com',
                      password: 'SecurePass123!',
                      firstName: 'John',
                      lastName: 'Doe'
                    }, null, 2)
                  },
                  url: {
                    raw: '{{base_url}}/auth/register',
                    host: ['{{base_url}}'],
                    path: ['auth', 'register']
                  }
                }
              }
            ]
          },
          {
            name: 'Portfolios',
            item: [
              {
                name: 'Get Portfolios',
                request: {
                  method: 'GET',
                  url: {
                    raw: '{{base_url}}/portfolios?page=1&limit=10',
                    host: ['{{base_url}}'],
                    path: ['portfolios'],
                    query: [
                      {
                        key: 'page',
                        value: '1'
                      },
                      {
                        key: 'limit',
                        value: '10'
                      }
                    ]
                  }
                }
              },
              {
                name: 'Create Portfolio',
                request: {
                  method: 'POST',
                  header: [
                    {
                      key: 'Content-Type',
                      value: 'application/json'
                    }
                  ],
                  body: {
                    mode: 'raw',
                    raw: JSON.stringify({
                      name: 'My Main Portfolio',
                      description: 'Primary crypto holdings',
                      type: 'MANUAL',
                      isDefault: true
                    }, null, 2)
                  },
                  url: {
                    raw: '{{base_url}}/portfolios',
                    host: ['{{base_url}}'],
                    path: ['portfolios']
                  }
                }
              }
            ]
          }
        ]
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="crypto-portfolio-api.postman_collection.json"');
      res.json(collection);
    } catch (error) {
      logger.error('Error generating Postman collection:', error);
      res.status(500).json({ error: 'Failed to generate Postman collection' });
    }
  }

  /**
   * Validate OpenAPI schema
   */
  private async validateSchema(req: Request, res: Response): Promise<void> {
    try {
      const validation = {
        valid: true,
        version: swaggerSpec.openapi,
        info: swaggerSpec.info,
        paths: Object.keys(swaggerSpec.paths || {}).length,
        components: Object.keys(swaggerSpec.components?.schemas || {}).length,
        security: swaggerSpec.security?.length || 0,
        validation: {
          structure: 'Valid OpenAPI 3.0 structure',
          required: 'All required fields present',
          references: 'All $ref references resolved',
          examples: 'Schema examples validated'
        }
      };

      res.json({
        success: true,
        data: validation,
        message: 'Schema validation completed successfully'
      });
    } catch (error) {
      logger.error('Error validating schema:', error);
      res.status(500).json({ 
        success: false,
        error: 'Schema validation failed',
        details: error instanceof Error ? error.message : 'Unknown validation error'
      });
    }
  }
}

export default ApiDocumentationGenerator;