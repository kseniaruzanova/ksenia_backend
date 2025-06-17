import { Request, Response, NextFunction } from 'express';

export const apiKeyMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const apiKey = req.headers['x-api-key'];
  const serverApiKey = process.env.N8N_API_KEY;

  if (!serverApiKey) {
    console.error('N8N_API_KEY is not defined in the environment.');
    res.status(500).json({ message: 'Server configuration error' });
    return;
  }

  if (!apiKey || apiKey !== serverApiKey) {
    res.status(401).json({ message: 'Unauthorized: Invalid API Key' });
    return;
  }

  next();
}; 