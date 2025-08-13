import swaggerJsdoc from 'swagger-jsdoc'
import swaggerUi from 'swagger-ui-express'
import { Express } from 'express'
import { config } from '@/config/config'

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Crypto Portfolio API',
      version: '1.0.0',
      description: `
        A comprehensive REST API for cryptocurrency portfolio management.
        
        ## Features
        - **Authentication & Authorization**: JWT-based auth with RBAC
        - **Portfolio Management**: Track crypto holdings across multiple exchanges
        - **Real-time Data**: Live price feeds and market data
        - **Security First**: Advanced encryption, 2FA, and security monitoring
        - **Exchange Integration**: Connect to major cryptocurrency exchanges
        - **Analytics**: Performance tracking and portfolio analytics
        
        ## Security
        All endpoints require proper authentication unless marked as public.
        Use the \`Authorization: Bearer <token>\` header with your JWT token.
        
        ## Rate Limiting
        API requests are rate limited to prevent abuse:
        - General API: 100 requests per 15 minutes
        - Authentication: 10 requests per 15 minutes
        - Market data: 200 requests per minute
      `,
      contact: {
        name: 'Crypto Portfolio API Support',
        email: 'support@cryptoportfolio.dev'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: `http://localhost:${config.port || 3001}/api/v1`,
        description: 'Development server'
      },
      {
        url: 'https://api.cryptoportfolio.dev/api/v1',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT authorization header using the Bearer scheme'
        },
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API key for service-to-service authentication'
        }
      },
      responses: {
        UnauthorizedError: {
          description: 'Authentication information is missing or invalid',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  error: { type: 'string', example: 'Unauthorized' },
                  message: { type: 'string', example: 'Invalid or missing authentication token' },
                  code: { type: 'string', example: 'UNAUTHORIZED' }
                }
              }
            }
          }
        },
        ForbiddenError: {
          description: 'Access forbidden - insufficient permissions',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  error: { type: 'string', example: 'Forbidden' },
                  message: { type: 'string', example: 'Insufficient permissions to access this resource' },
                  code: { type: 'string', example: 'FORBIDDEN' }
                }
              }
            }
          }
        },
        ValidationError: {
          description: 'Request validation failed',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  error: { type: 'string', example: 'Validation Error' },
                  message: { type: 'string', example: 'Request validation failed' },
                  code: { type: 'string', example: 'VALIDATION_ERROR' },
                  details: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        field: { type: 'string', example: 'email' },
                        message: { type: 'string', example: 'Invalid email format' },
                        code: { type: 'string', example: 'invalid_string' }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        RateLimitError: {
          description: 'Rate limit exceeded',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  error: { type: 'string', example: 'Rate Limit Exceeded' },
                  message: { type: 'string', example: 'Too many requests, please try again later' },
                  code: { type: 'string', example: 'RATE_LIMIT_EXCEEDED' },
                  retryAfter: { type: 'number', example: 900 }
                }
              }
            }
          }
        },
        ServerError: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  error: { type: 'string', example: 'Internal Server Error' },
                  message: { type: 'string', example: 'An unexpected error occurred' },
                  code: { type: 'string', example: 'INTERNAL_ERROR' },
                  requestId: { type: 'string', example: 'req_123456789' }
                }
              }
            }
          }
        }
      },
      schemas: {
        PaginationQuery: {
          type: 'object',
          properties: {
            page: {
              type: 'integer',
              minimum: 1,
              default: 1,
              description: 'Page number (1-based)'
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 10,
              description: 'Number of items per page'
            },
            sort: {
              type: 'string',
              description: 'Sort field (prefix with - for descending)',
              example: '-createdAt'
            }
          }
        },
        PaginationResponse: {
          type: 'object',
          properties: {
            page: { type: 'integer', example: 1 },
            limit: { type: 'integer', example: 10 },
            total: { type: 'integer', example: 100 },
            pages: { type: 'integer', example: 10 },
            hasNext: { type: 'boolean', example: true },
            hasPrev: { type: 'boolean', example: false }
          }
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Operation completed successfully' },
            data: {
              type: 'object',
              description: 'Response data (varies by endpoint)'
            },
            pagination: {
              $ref: '#/components/schemas/PaginationResponse'
            }
          }
        }
      }
    },
    security: [
      {
        BearerAuth: []
      }
    ],
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and authorization endpoints'
      },
      {
        name: 'Users',
        description: 'User management and profile operations'
      },
      {
        name: 'Portfolios',
        description: 'Portfolio creation and management'
      },
      {
        name: 'Exchanges',
        description: 'Exchange integration and management'
      },
      {
        name: 'Market Data',
        description: 'Real-time market data and pricing'
      },
      {
        name: 'Analytics',
        description: 'Portfolio analytics and performance metrics'
      },
      {
        name: 'API Keys',
        description: 'API key management for exchange integrations'
      },
      {
        name: 'Health',
        description: 'System health and status endpoints'
      }
    ]
  },
  apis: [
    './src/routes/**/*.ts',
    './src/controllers/**/*.ts',
    './src/schemas/**/*.ts'
  ]
}

export const swaggerSpec = swaggerJsdoc(swaggerOptions)

export const setupSwagger = (app: Express): void => {
  // Swagger UI options
  const swaggerUiOptions = {
    explorer: true,
    swaggerOptions: {
      docExpansion: 'none',
      filter: true,
      showRequestDuration: true,
      showCommonExtensions: true,
      tryItOutEnabled: true
    },
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info .title { color: #3b82f6 }
      .swagger-ui .scheme-container { background: #f8fafc; padding: 10px; border-radius: 4px }
    `,
    customSiteTitle: 'Crypto Portfolio API Documentation',
    customfavIcon: '/favicon.ico'
  }

  // Serve Swagger UI
  app.use('/api/v1/docs', swaggerUi.serve)
  app.get('/api/v1/docs', swaggerUi.setup(swaggerSpec, swaggerUiOptions))

  // Serve raw OpenAPI JSON
  app.get('/api/v1/swagger.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    res.send(swaggerSpec)
  })

  // API documentation redirect
  app.get('/docs', (req, res) => {
    res.redirect('/api/v1/docs')
  })
}

export default {
  swaggerSpec,
  setupSwagger
}