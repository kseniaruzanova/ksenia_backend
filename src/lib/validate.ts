import { Request, Response, NextFunction } from "express";
import { z, ZodError } from "zod";

export const validate = (schema: z.ZodTypeAny) => (req: Request, res: Response, next: NextFunction) => {
  try {
    schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    next();
  } catch (error) {
    if (error instanceof ZodError) {
      const errorMessages = error.issues.map((issue: any) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));

      res.status(400).json({ error: 'Invalid data', details: errorMessages });
    } else {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}; 
