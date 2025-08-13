import jwt from 'jsonwebtoken';
import { Socket } from 'socket.io';
import { ExtendedError } from 'socket.io/dist/namespace';

interface AuthenticatedSocket extends Socket {
  userId: string;
  userRole: string;
  email: string;
}

export const authenticateSocket = async (
  socket: Socket,
  next: (err?: ExtendedError) => void
): Promise<void> => {
  try {
    const token = socket.handshake.auth?.token || 
                  socket.handshake.headers?.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return next(new Error('Authentication token required'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    
    if (!decoded.userId) {
      return next(new Error('Invalid token payload'));
    }

    // Attach user info to socket
    const authSocket = socket as AuthenticatedSocket;
    authSocket.userId = decoded.userId;
    authSocket.userRole = decoded.role || 'BASIC';
    authSocket.email = decoded.email;
    
    // Log successful authentication
    console.log(`Socket authenticated: ${socket.id} for user ${decoded.userId}`);
    
    next();
  } catch (error) {
    console.error('Socket authentication error:', error);
    
    if (error instanceof jwt.TokenExpiredError) {
      return next(new Error('Token expired'));
    } else if (error instanceof jwt.JsonWebTokenError) {
      return next(new Error('Invalid token'));
    }
    
    return next(new Error('Authentication failed'));
  }
};

export const requireRole = (requiredRole: string) => {
  return (socket: Socket, next: (err?: ExtendedError) => void) => {
    const authSocket = socket as AuthenticatedSocket;
    
    if (!authSocket.userRole) {
      return next(new Error('User role not found'));
    }

    const roleHierarchy = {
      'BASIC': 1,
      'PREMIUM': 2,
      'ADMIN': 3
    };

    const userRoleLevel = roleHierarchy[authSocket.userRole as keyof typeof roleHierarchy] || 0;
    const requiredRoleLevel = roleHierarchy[requiredRole as keyof typeof roleHierarchy] || 0;

    if (userRoleLevel < requiredRoleLevel) {
      return next(new Error(`Insufficient permissions. Required: ${requiredRole}`));
    }

    next();
  };
};