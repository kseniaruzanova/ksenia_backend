// src/lib/validators/authValidators.ts
import { z } from 'zod';

export const registerSchema = z.object({
    body: z.object({
        username: z.string().min(3, 'Username must be at least 3 characters long').max(30, 'Username must be at most 30 characters long'),
        email: z.string().email('Please enter a valid email address'),
        password: z.string().min(6, 'Password must be at least 6 characters long'),
    })
});

export type RegisterInput = z.infer<typeof registerSchema>['body'];

export const loginSchema = z.object({
    body: z.object({
        email: z.string().email('Please enter a valid email address'),
        password: z.string(),
    })
});

export type LoginInput = z.infer<typeof loginSchema>['body'];

export const forgotPasswordSchema = z.object({
    body: z.object({
        email: z.string().email('Please enter a valid email address'),
    }),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>['body'];

export const resetPasswordSchema = z.object({
    params: z.object({
        token: z.string(),
    }),
    body: z.object({
        password: z.string().min(6, 'Password must be at least 6 characters long'),
    }),
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>; 