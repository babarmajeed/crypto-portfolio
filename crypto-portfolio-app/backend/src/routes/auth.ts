import { Router } from 'express'

const authRouter = Router()

// POST /api/v1/auth/register
authRouter.post('/register', (_req, res) => {
  res.status(501).json({
    success: false,
    message: 'Registration endpoint not implemented yet',
  })
})

// POST /api/v1/auth/login
authRouter.post('/login', (_req, res) => {
  res.status(501).json({
    success: false,
    message: 'Login endpoint not implemented yet',
  })
})

// POST /api/v1/auth/logout
authRouter.post('/logout', (_req, res) => {
  res.status(501).json({
    success: false,
    message: 'Logout endpoint not implemented yet',
  })
})

// GET /api/v1/auth/me
authRouter.get('/me', (_req, res) => {
  res.status(501).json({
    success: false,
    message: 'User profile endpoint not implemented yet',
  })
})

export { authRouter }