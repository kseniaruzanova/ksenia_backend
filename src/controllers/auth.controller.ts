import { Request, Response } from 'express';
import { randomInt } from 'crypto';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import Customer from '../models/customer.model';
import ClubMember from '../models/clubMember.model';
import RegistrationVerification from '../models/registrationVerification.model';
import ClubRegistrationVerification from '../models/clubRegistrationVerification.model';
import { AuthPayload } from '../interfaces/auth';
import { sendRegistrationVerificationCode } from '../services/verificationDelivery.service';

dotenv.config();
const jwtSecret: string = process.env.JWT_SECRET || "";
const registrationCodeTtlMs = 10 * 60 * 1000;
const maxVerificationAttempts = 5;
const allowedTariffs = new Set(['none', 'basic', 'pro', 'tg_max']);
type ResolvedRegistrationTarget =
  | { error: string }
  | {
      channel: 'email';
      normalizedEmail: string;
      username: string;
    };

function resolveRegistrationTarget(channel: unknown, email: unknown, phone: unknown): ResolvedRegistrationTarget {
  if (phone) {
    return { error: 'Регистрация по телефону больше не поддерживается' };
  }

  if (channel !== 'email') {
    return { error: 'Доступна только регистрация по email' };
  }

  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const username = normalizedEmail;

  if (!username) {
    return { error: 'Email не может быть пустым' };
  }

  return {
    channel: 'email',
    normalizedEmail,
    username
  };
}

function maskEmail(email: string) {
  const [name, domain] = email.split('@');
  if (!name || !domain) return email;
  if (name.length <= 2) return `${name[0] || '*'}*@${domain}`;
  return `${name.slice(0, 2)}***@${domain}`;
}

function validateDesiredTariff(tariff: unknown): 'none' | 'basic' | 'pro' | 'tg_max' {
  if (typeof tariff === 'string' && allowedTariffs.has(tariff)) {
    return tariff as 'none' | 'basic' | 'pro' | 'tg_max';
  }

  return 'none';
}

function makePlaceholderBotToken(username: string) {
  const safeUsername = username.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24) || 'customer';
  return `pending_${safeUsername}_${Date.now()}`;
}

export const userRegister = async (req: Request, res: Response) => {
  const { channel, email, phone, password, tariff } = req.body ?? {};

  if (!password || typeof password !== 'string' || password.length < 6) {
    res.status(400).json({ message: 'Пароль должен быть не короче 6 символов' });
    return;
  }

  const target = resolveRegistrationTarget(channel, email, phone);
  if ('error' in target) {
    res.status(400).json({ message: target.error });
    return;
  }

  const desiredTariff = validateDesiredTariff(tariff);

  try {
    const existingCustomer = await Customer.findOne({ username: target.username });
    if (existingCustomer) {
      res.status(409).json({
        message: 'Пользователь с таким email уже зарегистрирован'
      });
      return;
    }

    const existingClubMember = await ClubMember.findOne({ username: target.username });
    if (existingClubMember) {
      res.status(409).json({
        message: 'Этот email уже зарегистрирован в клубе. Войдите через раздел «Клуб магии».'
      });
      return;
    }

    const code = String(randomInt(100000, 1000000));
    const expiresAt = new Date(Date.now() + registrationCodeTtlMs);

    await RegistrationVerification.deleteMany({ username: target.username, channel: target.channel });

    await RegistrationVerification.create({
      username: target.username,
      channel: target.channel,
      email: target.normalizedEmail || undefined,
      password,
      desiredTariff,
      code,
      attempts: 0,
      expiresAt
    });

    await sendRegistrationVerificationCode({
      channel: target.channel,
      target: target.username,
      code
    });

    res.status(200).json({
      message: 'Код отправлен на email',
      login: target.username,
      target: maskEmail(target.username),
      expiresIn: Math.floor(registrationCodeTtlMs / 1000),
      desiredTariff
    });
  } catch (error) {
    res.status(500).json({ message: 'Не удалось отправить код подтверждения', error });
  }
};

export const verifyRegistrationCode = async (req: Request, res: Response) => {
  const { channel, email, phone, code } = req.body ?? {};

  if (!code || typeof code !== 'string' || !/^\d{6}$/.test(code.trim())) {
    res.status(400).json({ message: 'Введите корректный 6-значный код' });
    return;
  }

  const target = resolveRegistrationTarget(channel, email, phone);
  if ('error' in target) {
    res.status(400).json({ message: target.error });
    return;
  }

  try {
    const verification = await RegistrationVerification.findOne({
      username: target.username,
      channel: target.channel,
    }).sort({ createdAt: -1 });

    if (!verification) {
      res.status(404).json({ message: 'Сначала запросите код подтверждения' });
      return;
    }

    if (verification.expiresAt.getTime() < Date.now()) {
      await RegistrationVerification.deleteMany({ username: target.username, channel: target.channel });
      res.status(400).json({ message: 'Срок действия кода истёк. Запросите новый код.' });
      return;
    }

    if (verification.attempts >= maxVerificationAttempts) {
      await RegistrationVerification.deleteMany({ username: target.username, channel: target.channel });
      res.status(429).json({ message: 'Слишком много неверных попыток. Запросите новый код.' });
      return;
    }

    if (verification.code !== code.trim()) {
      verification.attempts += 1;
      await verification.save();
      res.status(400).json({ message: 'Неверный код подтверждения' });
      return;
    }

    const existingCustomer = await Customer.findOne({ username: target.username });
    if (existingCustomer) {
      await RegistrationVerification.deleteMany({ username: target.username, channel: target.channel });
      res.status(409).json({ message: 'Пользователь уже зарегистрирован' });
      return;
    }

    const existingClub = await ClubMember.findOne({ username: target.username });
    if (existingClub) {
      await RegistrationVerification.deleteMany({ username: target.username, channel: target.channel });
      res.status(409).json({
        message: 'Этот email зарегистрирован в клубе. Используйте вход из раздела клуба.'
      });
      return;
    }

    const customer = await Customer.create({
      username: target.username,
      password: verification.password,
      botToken: makePlaceholderBotToken(target.username),
      tariff: 'none',
      subscriptionStatus: 'inactive',
      subscriptionEndsAt: null
    });

    await RegistrationVerification.deleteMany({ username: target.username, channel: target.channel });

    res.status(201).json({
      message: 'Регистрация успешна',
      role: 'customer',
      login: customer.username,
      customerId: customer._id,
      tariff: customer.tariff,
      subscriptionStatus: customer.subscriptionStatus,
      desiredTariff: verification.desiredTariff
    });
  } catch (error) {
    res.status(500).json({ message: 'Ошибка подтверждения регистрации', error });
  }
};

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
      return;
    }

    if (decoded.role === 'club_member') {
      const member = await ClubMember.findById(decoded.clubMemberId);

      if (!member) {
        res.status(404).json({ message: 'Club member not found in database' });
        return;
      }

      res.json({
        message: 'Club member token verification',
        tokenValid: true,
        tokenData: decoded,
        actualData: {
          username: member.username,
          clubMemberId: member._id,
          role: 'club_member',
          tariff: member.tariff
        },
        tokenAge: Math.floor((Date.now() / 1000) - decoded.iat),
        expiresIn: decoded.exp - Math.floor(Date.now() / 1000)
      });
      return;
    }

    res.json({
      message: 'Admin token verification',
      tokenValid: true,
      tokenData: decoded,
      tokenAge: Math.floor((Date.now() / 1000) - decoded.iat),
      expiresIn: decoded.exp - Math.floor(Date.now() / 1000)
    });
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

    if (decoded.role === 'club_member') {
      const member = await ClubMember.findById((decoded as any).clubMemberId);

      if (!member) {
        res.status(404).json({ message: 'Club member not found' });
        return;
      }

      const payload = {
        username: member.username,
        role: 'club_member' as const,
        clubMemberId: member._id,
        botToken: '',
        tariff: member.tariff
      };

      const newToken: string = jwt.sign(payload, jwtSecret, { expiresIn: '8h' });

      res.json({
        message: 'Club member token refreshed',
        token: newToken,
        role: 'club_member',
        clubMemberId: member._id
      });
      return;
    }

    res.status(400).json({ message: 'Unknown user role' });
  } catch (error) {
    res.status(401).json({ message: 'Invalid token', error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

/** Регистрация только в коллекции клуба + ClubRegistrationVerification */
export const clubUserRegister = async (req: Request, res: Response) => {
  const { channel, email, phone, password, tariff } = req.body ?? {};

  if (!password || typeof password !== 'string' || password.length < 6) {
    res.status(400).json({ message: 'Пароль должен быть не короче 6 символов' });
    return;
  }

  const target = resolveRegistrationTarget(channel, email, phone);
  if ('error' in target) {
    res.status(400).json({ message: target.error });
    return;
  }

  const desiredTariff = validateDesiredTariff(tariff);

  try {
    const existingClub = await ClubMember.findOne({ username: target.username });
    if (existingClub) {
      res.status(409).json({ message: 'Этот email уже зарегистрирован в клубе' });
      return;
    }

    const existingCustomer = await Customer.findOne({ username: target.username });
    if (existingCustomer) {
      res.status(409).json({
        message: 'Этот email уже зарегистрирован на платформе. Используйте другой email для клуба или войдите в платформу.'
      });
      return;
    }

    const code = String(randomInt(100000, 1000000));
    const expiresAt = new Date(Date.now() + registrationCodeTtlMs);

    await ClubRegistrationVerification.deleteMany({ username: target.username, channel: target.channel });

    await ClubRegistrationVerification.create({
      username: target.username,
      channel: target.channel,
      email: target.normalizedEmail || undefined,
      password,
      desiredTariff,
      code,
      attempts: 0,
      expiresAt
    });

    await sendRegistrationVerificationCode({
      channel: target.channel,
      target: target.username,
      code
    });

    res.status(200).json({
      message: 'Код отправлен на email',
      login: target.username,
      target: maskEmail(target.username),
      expiresIn: Math.floor(registrationCodeTtlMs / 1000),
      desiredTariff
    });
  } catch (error) {
    res.status(500).json({ message: 'Не удалось отправить код подтверждения', error });
  }
};

export const clubVerifyRegistrationCode = async (req: Request, res: Response) => {
  const { channel, email, phone, code } = req.body ?? {};

  if (!code || typeof code !== 'string' || !/^\d{6}$/.test(code.trim())) {
    res.status(400).json({ message: 'Введите корректный 6-значный код' });
    return;
  }

  const target = resolveRegistrationTarget(channel, email, phone);
  if ('error' in target) {
    res.status(400).json({ message: target.error });
    return;
  }

  try {
    const verification = await ClubRegistrationVerification.findOne({
      username: target.username,
      channel: target.channel
    }).sort({ createdAt: -1 });

    if (!verification) {
      res.status(404).json({ message: 'Сначала запросите код подтверждения' });
      return;
    }

    if (verification.expiresAt.getTime() < Date.now()) {
      await ClubRegistrationVerification.deleteMany({ username: target.username, channel: target.channel });
      res.status(400).json({ message: 'Срок действия кода истёк. Запросите новый код.' });
      return;
    }

    if (verification.attempts >= maxVerificationAttempts) {
      await ClubRegistrationVerification.deleteMany({ username: target.username, channel: target.channel });
      res.status(429).json({ message: 'Слишком много неверных попыток. Запросите новый код.' });
      return;
    }

    if (verification.code !== code.trim()) {
      verification.attempts += 1;
      await verification.save();
      res.status(400).json({ message: 'Неверный код подтверждения' });
      return;
    }

    const existingClub = await ClubMember.findOne({ username: target.username });
    if (existingClub) {
      await ClubRegistrationVerification.deleteMany({ username: target.username, channel: target.channel });
      res.status(409).json({ message: 'Пользователь уже зарегистрирован' });
      return;
    }

    const member = await ClubMember.create({
      username: target.username,
      password: verification.password,
      tariff: 'none',
      subscriptionStatus: 'inactive',
      subscriptionEndsAt: null
    });

    await ClubRegistrationVerification.deleteMany({ username: target.username, channel: target.channel });

    res.status(201).json({
      message: 'Регистрация успешна',
      role: 'club_member',
      login: member.username,
      clubMemberId: member._id,
      tariff: member.tariff,
      subscriptionStatus: member.subscriptionStatus,
      desiredTariff: verification.desiredTariff
    });
  } catch (error) {
    res.status(500).json({ message: 'Ошибка подтверждения регистрации', error });
  }
};

export const clubUserLogin = async (req: Request, res: Response) => {
  const { login: username, password } = req.body ?? {};

  try {
    const member = await ClubMember.findOne({ username });
    if (member && password === member.password) {
      const token: string = jwt.sign(
        {
          username: member.username,
          role: 'club_member',
          clubMemberId: member._id,
          botToken: '',
          tariff: member.tariff
        },
        jwtSecret,
        { expiresIn: '8h' }
      );

      res.json({ token, role: 'club_member' });
      return;
    }
  } catch (error) {
    res.status(500).json({ message: 'Ошибка входа в клуб', error });
    return;
  }

  res.status(401).json({ message: 'Неверный логин или пароль' });
};
