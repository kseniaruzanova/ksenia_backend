import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import Customer from '../models/customer.model';
import { AuthPayload } from '../interfaces/auth';

dotenv.config();
const jwtSecret: string = process.env.JWT_SECRET || "";

export const userLogin = async (req: Request, res: Response) => {
  const { login: username, password } = req.body;

  const adminLogin = process.env.ADMIN_LOGIN || "admin";
  const adminPassword = process.env.ADMIN_PASSWORD || "password";

  if (adminLogin && adminPassword && username === adminLogin && password === adminPassword) {
    const token: string = jwt.sign({ username: adminLogin, role: 'admin', tariff: "pro" }, jwtSecret, { expiresIn: '16h' });
    
    res.json({ token, role: 'admin' });
    return;
  }

  try {
    const customer = await Customer.findOne({ username });
    if (customer && password === customer.password) {
      const payload: AuthPayload = {
        username: customer.username,
        role: 'customer',
        customerId: customer._id,
        botToken: customer.botToken,
        tariff: customer.tariff
      };

      const token: string = jwt.sign(payload, jwtSecret, { expiresIn: '8h' });

      res.json({ token, role: 'customer' });
      return;
    }
  } catch (error) {
    res.status(500).json({ message: 'Error during customer authentication', error });
    return;
  }

  res.status(401).json({ message: 'Invalid credentials' });
};

export const verifyToken = async (req: any, res: Response) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ message: 'No token provided' });
    return;
  }

  const token: string = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, jwtSecret) as any;

    if (decoded.role === 'customer') {
      const customer = await Customer.findById(decoded.customerId);
      
      if (!customer) {
        res.status(404).json({ message: 'Customer not found in database' });
        return;
      }

      const actualData: AuthPayload = {
        username: customer.username,
        customerId: customer._id,
        botToken: customer.botToken,
        role: "customer",
        tariff: customer.tariff
      };

      const tokenData: AuthPayload = {
        username: decoded.username,
        customerId: customer._id,
        botToken: customer.botToken,
        role: "customer",
        tariff: customer.tariff
      };

      res.json({
        message: 'Token verification',
        tokenValid: true,
        tokenData: decoded,
        actualData,
        dataMatches: JSON.stringify(tokenData) === JSON.stringify(actualData),
        tokenAge: Math.floor((Date.now() / 1000) - decoded.iat),
        expiresIn: decoded.exp - Math.floor(Date.now() / 1000)
      });
    } else {
      res.json({
        message: 'Admin token verification',
        tokenValid: true,
        tokenData: decoded,
        tokenAge: Math.floor((Date.now() / 1000) - decoded.iat),
        expiresIn: decoded.exp - Math.floor(Date.now() / 1000)
      });
    }
  } catch (error) {
    res.status(401).json({ message: 'Invalid token', error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const refreshToken = async (req: any, res: Response) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ message: 'No token provided' });
    return;
  }

  const oldToken: string = authHeader.split(' ')[1];

  try {
    const decoded: jwt.JwtPayload = jwt.verify(oldToken, jwtSecret) as jwt.JwtPayload;

    if (decoded.role === 'admin') {
      const newToken: string = jwt.sign({ 
        username: decoded.username, 
        role: 'admin', 
        tariff: "pro"
      }, jwtSecret, { expiresIn: '16h' });
      
      res.json({ 
        message: 'Admin token refreshed',
        token: newToken, 
        role: 'admin' 
      });
      return;
    }

    if (decoded.role === 'customer') {
      const customer = await Customer.findById(decoded.customerId);
      
      if (!customer) {
        res.status(404).json({ message: 'Customer not found' });
        return;
      }

      const payload: AuthPayload = {
        username: customer.username,
        role: 'customer',
        customerId: customer._id,
        botToken: customer.botToken,
        tariff: customer.tariff
      };
      
      const newToken: string = jwt.sign(payload, jwtSecret, { expiresIn: '8h' });
      
      res.json({ 
        message: 'Customer token refreshed with actual data',
        token: newToken, 
        role: 'customer',
        customerId: customer._id
      });
      return;
    }

    res.status(400).json({ message: 'Unknown user role' });
  } catch (error) {
    res.status(401).json({ message: 'Invalid token', error: error instanceof Error ? error.message : 'Unknown error' });
  }
}; 
