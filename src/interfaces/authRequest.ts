import jwt from "jsonwebtoken";
import { Request } from "express";

export interface AuthRequest extends Request {
  user?: {
    username: string;
    role: 'admin' | 'customer';
    customerId?: string;
    botToken?: string;
  } & jwt.JwtPayload;
}
