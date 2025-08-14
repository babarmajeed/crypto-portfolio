import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Crypto Portfolio API',
      version: '1.0.0',
      description: 'Comprehensive API for managing cryptocurrency portfolios with real-time tracking, analytics, and secure transactions',
      termsOfService: 'https://cryptoportfolio.com/terms',
      contact: {
        name: 'API Support Team',
        email: 'api-support@cryptoportfolio.com',
        url: 'https://docs.cryptoportfolio.com/support'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    externalDocs: {
      description: 'Complete Developer Documentation',
      url: 'https://docs.cryptoportfolio.com'
    },
    servers: [
      {
        url: 'https://api.cryptoportfolio.com/v1',
        description: 'Production Server'
      },
      {
        url: 'https://staging-api.cryptoportfolio.com/v1',
        description: 'Staging Server'
      },
      {
        url: 'http://localhost:3000/api/v1',
        description: 'Development Server'
      }
    ],
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and authorization endpoints'
      },
      {
        name: 'Portfolios',
        description: 'Portfolio management operations'
      },
      {
        name: 'Transactions',
        description: 'Transaction tracking and management'
      },
      {
        name: 'Market Data',
        description: 'Real-time cryptocurrency market data'
      },
      {
        name: 'Analytics',
        description: 'Portfolio analytics and reporting'
      },
      {
        name: 'Users',
        description: 'User account management'
      },
      {
        name: 'Files',
        description: 'File upload and document management'
      },
      {
        name: 'Monitoring',
        description: 'System monitoring and health checks'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token obtained from login endpoint'
        },
        apiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API key for service-to-service authentication'
        },
        refreshToken: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Refresh token for obtaining new access tokens'
        }
      },
      parameters: {
        PageParam: {
          name: 'page',
          in: 'query',
          description: 'Page number for pagination (starts from 1)',
          schema: {
            type: 'integer',
            minimum: 1,
            default: 1
          }
        },
        LimitParam: {
          name: 'limit',
          in: 'query',
          description: 'Number of items per page',
          schema: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            default: 20
          }
        },
        SortParam: {
          name: 'sort',
          in: 'query',
          description: 'Sort field and direction (e.g., createdAt:desc)',
          schema: {
            type: 'string',
            pattern: '^[a-zA-Z]+:(asc|desc)$',
            default: 'createdAt:desc'
          }
        }
      },
      responses: {
        UnauthorizedError: {
          description: 'Authentication required',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorResponse'
              },
              example: {
                error: 'UnauthorizedError',
                message: 'Authentication token required',
                timestamp: '2024-01-15T10:30:00Z',
                path: '/api/v1/portfolios'
              }
            }
          }
        },
        ForbiddenError: {
          description: 'Access forbidden',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorResponse'
              }
            }
          }
        },
        NotFoundError: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorResponse'
              }
            }
          }
        },
        ValidationError: {
          description: 'Invalid input data',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ValidationErrorResponse'
              }
            }
          }
        },
        RateLimitError: {
          description: 'Rate limit exceeded',
          headers: {
            'X-RateLimit-Limit': {
              description: 'Request limit per time window',
              schema: {
                type: 'integer'
              }
            },
            'X-RateLimit-Remaining': {
              description: 'Remaining requests in current window',
              schema: {
                type: 'integer'
              }
            },
            'X-RateLimit-Reset': {
              description: 'Time when the rate limit resets',
              schema: {
                type: 'string',
                format: 'date-time'
              }
            },
            'Retry-After': {
              description: 'Seconds until the rate limit resets',
              schema: {
                type: 'integer'
              }
            }
          },
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorResponse'
              }
            }
          }
        },
        ServerError: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorResponse'
              }
            }
          }
        }
      },
      schemas: {
        User: {
          type: 'object',
          required: ['id', 'email', 'firstName', 'lastName'],
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Unique user identifier',
              example: '123e4567-e89b-12d3-a456-426614174000'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address',
              example: 'user@example.com'
            },
            firstName: {
              type: 'string',
              minLength: 1,
              maxLength: 50,
              description: 'User first name',
              example: 'John'
            },
            lastName: {
              type: 'string',
              minLength: 1,
              maxLength: 50,
              description: 'User last name',
              example: 'Doe'
            },
            isEmailVerified: {
              type: 'boolean',
              description: 'Email verification status',
              example: true
            },
            twoFactorEnabled: {
              type: 'boolean',
              description: 'Two-factor authentication status',
              example: false
            },
            role: {
              type: 'string',
              enum: ['USER', 'ADMIN', 'MODERATOR'],
              description: 'User role',
              example: 'USER'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Account creation timestamp',
              example: '2024-01-15T10:30:00Z'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp',
              example: '2024-01-20T15:45:30Z'
            }
          }
        },
        Portfolio: {
          type: 'object',
          required: ['id', 'name', 'userId'],
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Unique portfolio identifier',
              example: '456e7890-e89b-12d3-a456-426614174111'
            },
            name: {
              type: 'string',
              minLength: 1,
              maxLength: 100,
              description: 'Portfolio name',
              example: 'My Crypto Portfolio'
            },
            description: {
              type: 'string',
              maxLength: 500,
              description: 'Portfolio description',
              example: 'Long-term cryptocurrency investment portfolio'
            },
            userId: {
              type: 'string',
              format: 'uuid',
              description: 'Owner user ID',
              example: '123e4567-e89b-12d3-a456-426614174000'
            },
            totalValue: {
              type: 'number',
              format: 'float',
              minimum: 0,
              description: 'Total portfolio value in USD',
              example: 50000.00
            },
            totalChange24h: {
              type: 'number',
              format: 'float',
              description: '24-hour change in USD',
              example: 1250.75
            },
            totalChangePercent24h: {
              type: 'number',
              format: 'float',
              description: '24-hour percentage change',
              example: 2.56
            },
            isPublic: {
              type: 'boolean',
              description: 'Public visibility status',
              example: false
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Portfolio creation timestamp',
              example: '2024-01-15T10:30:00Z'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp',
              example: '2024-01-20T15:45:30Z'
            }
          }
        },
        Transaction: {
          type: 'object',
          required: ['id', 'portfolioId', 'symbol', 'type', 'amount', 'price'],
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Unique transaction identifier',
              example: '789e0123-e89b-12d3-a456-426614174222'
            },
            portfolioId: {
              type: 'string',
              format: 'uuid',
              description: 'Associated portfolio ID',
              example: '456e7890-e89b-12d3-a456-426614174111'
            },
            symbol: {
              type: 'string',
              pattern: '^[A-Z]{2,10}$',
              description: 'Cryptocurrency symbol',
              example: 'BTC'
            },
            type: {
              type: 'string',
              enum: ['BUY', 'SELL', 'TRANSFER_IN', 'TRANSFER_OUT', 'STAKE', 'UNSTAKE'],
              description: 'Transaction type',
              example: 'BUY'
            },
            amount: {
              type: 'number',
              format: 'float',
              minimum: 0,
              description: 'Transaction amount in cryptocurrency units',
              example: 0.5
            },
            price: {
              type: 'number',
              format: 'float',
              minimum: 0,
              description: 'Price per unit in USD',
              example: 45000.00
            },
            fee: {
              type: 'number',
              format: 'float',
              minimum: 0,
              description: 'Transaction fee in USD',
              example: 25.00
            },
            exchangeId: {
              type: 'string',
              description: 'Exchange where transaction occurred',
              example: 'binance'
            },
            notes: {
              type: 'string',
              maxLength: 500,
              description: 'Transaction notes',
              example: 'DCA purchase'
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'Transaction timestamp',
              example: '2024-01-15T10:30:00Z'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Record creation timestamp',
              example: '2024-01-15T10:35:00Z'
            }
          }
        },
        ErrorResponse: {
          type: 'object',
          required: ['error', 'message', 'timestamp'],
          properties: {
            error: {
              type: 'string',
              description: 'Error type or code',
              example: 'ValidationError'
            },
            message: {
              type: 'string',
              description: 'Human-readable error message',
              example: 'Invalid input data provided'
            },
            details: {
              type: 'object',
              description: 'Additional error details'
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'Error timestamp',
              example: '2024-01-15T10:30:00Z'
            },
            path: {
              type: 'string',
              description: 'Request path that caused the error',
              example: '/api/v1/portfolios'
            },
            requestId: {
              type: 'string',
              description: 'Unique request identifier for tracking',
              example: 'req_123456789'
            }
          }
        },
        ValidationErrorResponse: {
          allOf: [
            {
              $ref: '#/components/schemas/ErrorResponse'
            },
            {
              type: 'object',
              properties: {
                errors: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      field: {
                        type: 'string',
                        description: 'Field that failed validation'
                      },
                      message: {
                        type: 'string',
                        description: 'Validation error message'
                      },
                      code: {
                        type: 'string',
                        description: 'Validation error code'
                      }
                    }
                  }
                }
              }
            }
          ]
        },
        PaginationResponse: {
          type: 'object',
          properties: {
            page: {
              type: 'integer',
              minimum: 1,
              description: 'Current page number',
              example: 1
            },
            limit: {
              type: 'integer',
              minimum: 1,
              description: 'Items per page',
              example: 20
            },
            total: {
              type: 'integer',
              minimum: 0,
              description: 'Total number of items',
              example: 150
            },
            pages: {
              type: 'integer',
              minimum: 0,
              description: 'Total number of pages',
              example: 8
            },
            hasNext: {
              type: 'boolean',
              description: 'Whether there is a next page',
              example: true
            },
            hasPrev: {
              type: 'boolean',
              description: 'Whether there is a previous page',
              example: false
            }
          }
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Operation success status',
              example: true
            },
            message: {
              type: 'string',
              description: 'Success message',
              example: 'Operation completed successfully'
            },
            data: {
              description: 'Response data'
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
        bearerAuth: []
      }
    ]
  },
  apis: [
    './src/routes/v1/*.ts',
    './src/routes/*.ts',
    './src/controllers/*.ts',
    './src/models/*.ts'
  ]
};

export const specs = swaggerJsdoc(options);

export const swaggerConfig = {
  swaggerDefinition: options.definition,
  apis: options.apis
};

export const swaggerUiOptions = {
  explorer: true,
  swaggerOptions: {
    docExpansion: 'none',
    defaultModelsExpandDepth: 2,
    defaultModelExpandDepth: 2,
    displayRequestDuration: true,
    filter: true,
    showExtensions: true,
    showCommonExtensions: true,
    tryItOutEnabled: true,
    requestInterceptor: (request: any) => {
      // Add default headers
      request.headers['Content-Type'] = 'application/json';
      return request;
    }
  },
  customCss: `
    .swagger-ui .topbar { display: none; }
    .swagger-ui .info .title { color: #1f2937; }
    .swagger-ui .scheme-container { background: #f9fafb; }
    .swagger-ui .opblock.opblock-post { border-color: #10b981; }
    .swagger-ui .opblock.opblock-get { border-color: #3b82f6; }
    .swagger-ui .opblock.opblock-put { border-color: #f59e0b; }
    .swagger-ui .opblock.opblock-delete { border-color: #ef4444; }
  `,
  customSiteTitle: 'Crypto Portfolio API Documentation',
  customfavIcon: '/assets/favicon.ico'
};

export default {
  specs,
  swaggerConfig,
  swaggerUiOptions
};