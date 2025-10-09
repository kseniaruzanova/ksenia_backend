import jwt from "jsonwebtoken";
import { Response, NextFunction } from "express";

import { AuthRequest } from "../interfaces/authRequest";

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader: string | undefined = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Unauthorized: No token provided' });
    return;
  }

  const token: string = authHeader.split(' ')[1];
  const secret: string = process.env.JWT_SECRET || "";

  if (!secret) {
    throw new Error('JWT_SECRET is not defined');
  }

  try {
    const decoded: jwt.JwtPayload | string = jwt.verify(token, secret);
    req.user = decoded as AuthRequest['user'];
    
    const isCustomerRoute: boolean = req.originalUrl.includes('/api/messages');
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
