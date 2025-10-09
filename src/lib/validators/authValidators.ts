import { z } from "zod";

export const registerSchema: z.ZodObject = z.object({
    body: z.object({
        username: z.string().min(3, 'Username must be at least 3 characters long').max(30, 'Username must be at most 30 characters long'),
        email: z.string().email('Please enter a valid email address'),
        password: z.string().min(6, 'Password must be at least 6 characters long'),
    })
});

export const loginSchema: z.ZodObject = z.object({
    body: z.object({
        email: z.string().email('Please enter a valid email address'),
        password: z.string(),
    })
});

export const forgotPasswordSchema: z.ZodObject = z.object({
    body: z.object({
        email: z.string().email('Please enter a valid email address'),
    }),
});

export const resetPasswordSchema: z.ZodObject = z.object({
    params: z.object({
        token: z.string(),
    }),
    body: z.object({
        password: z.string().min(6, 'Password must be at least 6 characters long'),
    }),
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>; 
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>['body'];
export type RegisterInput = z.infer<typeof registerSchema>['body'];
export type LoginInput = z.infer<typeof loginSchema>['body'];
