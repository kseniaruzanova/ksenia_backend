import jwt from "jsonwebtoken";
import { Request } from "express";

export interface AuthRequest extends Request {
  user?: {
    username: string;
    role: "admin" | "customer" | "club_member";
    customerId?: string;
    clubMemberId?: string;
    botToken?: string;
  } & jwt.JwtPayload;
}
