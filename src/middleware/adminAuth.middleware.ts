import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';

export const adminAuthMiddleware = (req: AuthRequest, res: Response, next: NextFunction): void => {
  // Проверяем, что пользователь аутентифицирован
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized: No authentication data' });
    return;
  }

  // Проверяем, что пользователь является супер администратором
  if (req.user.role !== 'admin') {
    res.status(403).json({ message: 'Forbidden: Only super administrators can access this resource' });
    return;
  }

  next();
};