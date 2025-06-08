import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

export const login = async (req: Request, res: Response) => {
    const { login, password } = req.body;

    const adminLogin = process.env.ADMIN_LOGIN;
    const adminPassword = process.env.ADMIN_PASSWORD;
    const jwtSecret = process.env.JWT_SECRET;

    if (!adminLogin || !adminPassword || !jwtSecret) {
        res.status(500).json({ message: 'Server configuration error' });
        return;
    }

    const isLoginValid = (login === adminLogin);
    // In a real app, you'd compare against a hashed password from a DB
    // For this case, we just check the plain text password from .env
    const isPasswordValid = (password === adminPassword);

    if (!isLoginValid || !isPasswordValid) {
        res.status(401).json({ message: 'Invalid credentials' });
        return;
    }

    // For simplicity, we are not using bcrypt here for the .env password,
    // but if it were from a DB, you'd use:
    // const isPasswordValid = await bcrypt.compare(password, user.password);

    const token = jwt.sign({ login: adminLogin, role: 'admin' }, jwtSecret, { expiresIn: '1h' });

    res.json({ token });
}; 