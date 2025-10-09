import { Response, NextFunction } from 'express';
import { AuthRequest } from '../interfaces/authRequest';

export const adminAuthMiddleware = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized: No authentication data' });
    return;
  }

  if (req.user.role !== 'admin') {
    res.status(403).json({ message: 'Forbidden: Only super administrators can access this resource' });
    return;
  }

  next();
};
