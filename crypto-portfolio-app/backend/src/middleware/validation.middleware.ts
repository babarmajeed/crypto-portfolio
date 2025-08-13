import { Request, Response, NextFunction } from 'express'
import { ZodSchema, ZodError } from 'zod'
import { logger } from '@/utils/logger'

export interface ValidationError {
  field: string
  message: string
  code: string
  path: (string | number)[]
}

export interface ValidatedRequest<T = any> extends Request {
  validated: T
}

/**
 * Creates a validation middleware for request data
 * @param schema - Zod schema to validate against
 * @param property - Which part of the request to validate ('body' | 'query' | 'params')
 * @returns Express middleware function
 */
export const validate = (
  schema: ZodSchema<any>,
  property: 'body' | 'query' | 'params' = 'body'
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const dataToValidate = req[property]
      
      // Parse and validate the data
      const result = schema.safeParse(dataToValidate)
      
      if (!result.success) {
        const errors: ValidationError[] = result.error.errors.map((error) => ({
          field: error.path.join('.') || 'root',
          message: error.message,
          code: error.code,
          path: error.path
        }))

        logger.warn('Request validation failed', {
          method: req.method,
          url: req.originalUrl,
          property,
          errors
        })

        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Request validation failed',
          code: 'VALIDATION_ERROR',
          details: errors
        })
      }

      // Add validated data to request for use in controllers
      ;(req as ValidatedRequest).validated = result.data

      next()
    } catch (error) {
      logger.error('Validation middleware error', { error })
      
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Validation processing failed',
        code: 'VALIDATION_PROCESSING_ERROR'
      })
    }
  }
}

/**
 * Validates multiple request properties
 * @param schemas - Object containing schemas for different request properties
 * @returns Express middleware function
 */
export const validateMultiple = (schemas: {
  body?: ZodSchema<any>
  query?: ZodSchema<any>
  params?: ZodSchema<any>
}) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated: any = {}
      const errors: ValidationError[] = []

      // Validate each specified property
      for (const [property, schema] of Object.entries(schemas)) {
        if (schema) {
          const dataToValidate = req[property as keyof Request]
          const result = schema.safeParse(dataToValidate)

          if (!result.success) {
            const propertyErrors = result.error.errors.map((error) => ({
              field: `${property}.${error.path.join('.') || 'root'}`,
              message: error.message,
              code: error.code,
              path: [property, ...error.path]
            }))
            errors.push(...propertyErrors)
          } else {
            validated[property] = result.data
          }
        }
      }

      if (errors.length > 0) {
        logger.warn('Multi-property validation failed', {
          method: req.method,
          url: req.originalUrl,
          errors
        })

        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Request validation failed',
          code: 'VALIDATION_ERROR',
          details: errors
        })
      }

      // Add all validated data to request
      ;(req as ValidatedRequest).validated = validated

      next()
    } catch (error) {
      logger.error('Multi-validation middleware error', { error })
      
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Validation processing failed',
        code: 'VALIDATION_PROCESSING_ERROR'
      })
    }
  }
}

/**
 * Optional validation - continues even if validation fails but adds warnings
 * @param schema - Zod schema to validate against
 * @param property - Which part of the request to validate
 * @returns Express middleware function
 */
export const validateOptional = (
  schema: ZodSchema<any>,
  property: 'body' | 'query' | 'params' = 'body'
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const dataToValidate = req[property]
      const result = schema.safeParse(dataToValidate)

      if (result.success) {
        ;(req as ValidatedRequest).validated = result.data
      } else {
        logger.warn('Optional validation failed - continuing', {
          method: req.method,
          url: req.originalUrl,
          property,
          errors: result.error.errors
        })
        
        // Set original data as validated for consistency
        ;(req as ValidatedRequest).validated = dataToValidate
      }

      next()
    } catch (error) {
      logger.error('Optional validation middleware error', { error })
      // Continue with original data on error
      ;(req as ValidatedRequest).validated = req[property]
      next()
    }
  }
}

/**
 * Sanitizes and transforms request data based on schema
 * Useful for cleaning user input before validation
 */
export const sanitize = (
  schema: ZodSchema<any>,
  property: 'body' | 'query' | 'params' = 'body'
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const dataToSanitize = req[property]
      
      // Apply transformations defined in schema
      const sanitized = schema.parse(dataToSanitize)
      
      // Update request with sanitized data
      req[property] = sanitized
      
      next()
    } catch (error) {
      if (error instanceof ZodError) {
        const errors: ValidationError[] = error.errors.map((err) => ({
          field: err.path.join('.') || 'root',
          message: err.message,
          code: err.code,
          path: err.path
        }))

        return res.status(400).json({
          success: false,
          error: 'Sanitization Error',
          message: 'Data sanitization failed',
          code: 'SANITIZATION_ERROR',
          details: errors
        })
      }

      logger.error('Sanitization middleware error', { error })
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Data sanitization processing failed',
        code: 'SANITIZATION_PROCESSING_ERROR'
      })
    }
  }
}

export default {
  validate,
  validateMultiple,
  validateOptional,
  sanitize
}