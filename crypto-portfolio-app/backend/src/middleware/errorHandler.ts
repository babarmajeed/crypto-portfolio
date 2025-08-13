import { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import { logger } from '@/utils/logger'

export interface AppError extends Error {
  statusCode?: number
  isOperational?: boolean
}

export class CustomError extends Error implements AppError {
  public statusCode: number
  public isOperational: boolean

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message)
    this.statusCode = statusCode
    this.isOperational = isOperational

    Error.captureStackTrace(this, this.constructor)
  }
}

export const errorHandler = (
  error: AppError | ZodError | Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  let statusCode = 500
  let message = 'Internal Server Error'
  let errors: any = undefined

  // Zod validation errors
  if (error instanceof ZodError) {
    statusCode = 400
    message = 'Validation Error'
    errors = error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
    }))
  }
  // Custom app errors
  else if (error instanceof CustomError) {
    statusCode = error.statusCode
    message = error.message
  }
  // Prisma errors
  else if (error.message.includes('Unique constraint')) {
    statusCode = 409
    message = 'Resource already exists'
  }
  else if (error.message.includes('Record to update not found')) {
    statusCode = 404
    message = 'Resource not found'
  }
  // JWT errors
  else if (error.message.includes('jwt')) {
    statusCode = 401
    message = 'Invalid token'
  }

  // Log error
  logger.error('Error occurred:', {
    message: error.message,
    stack: error.stack,
    statusCode,
  })

  // Send error response
  res.status(statusCode).json({
    success: false,
    message,
    ...(errors && { errors }),
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
  })
}