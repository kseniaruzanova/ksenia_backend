import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  user?: {
    username: string;
    role: 'admin' | 'customer';
    customerId?: string;
    botToken?: string;
  } & jwt.JwtPayload;
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Unauthorized: No token provided' });
    return;
  }

  const token = authHeader.split(' ')[1];
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET is not defined');
  }

  try {
    const decoded = jwt.verify(token, secret);
    req.user = decoded as AuthRequest['user'];
    
    const isCustomerRoute = req.originalUrl.includes('/api/messages') || req.originalUrl.includes('/api/users');
    if (req.user?.role === 'admin' && isCustomerRoute) {
        const allowedForAdmin = ['/api/customers', '/api/auth/login'];
        const isAdminSpecificRoute = allowedForAdmin.some(route => req.originalUrl.startsWith(route));
        
        if (!isAdminSpecificRoute) {
             res.status(403).json({ message: 'Forbidden: Admins cannot access customer-specific routes' });
             return;
        }
    }

    next();
  } catch (error) {
    res.status(401).json({ message: 'Unauthorized: Invalid token' });
  }
}; 