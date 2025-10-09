import { Request, Response, NextFunction } from 'express';

import { AppError } from '../interfaces/appError';
import { sendErrorDev, sendErrorProd } from '../utils/error';

export const globalErrorHandler = (err: AppError, req: Request, res: Response, next: NextFunction) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'production') {
    sendErrorProd(err, res);
  } else {
    sendErrorDev(err, res);
  }
}; 
