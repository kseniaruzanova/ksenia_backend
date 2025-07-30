import { z } from 'zod';

export const createContentSchema = z.object({
    body: z.object({
        productType: z.string().min(1, 'Тип продукта обязателен'),
        productId: z.string().min(1, 'ID продукта обязателен'),
        title: z.string()
            .min(1, 'Заголовок не может быть пустым')
            .max(200, 'Заголовок не может быть длиннее 200 символов')
            .trim(),
        description: z.string()
            .min(1, 'Описание не может быть пустым')
            .max(500, 'Описание не может быть длиннее 500 символов')
            .trim(),
        content: z.string()
            .min(1, 'Контент не может быть пустым')
            .trim(),
        isActive: z.boolean().optional().default(true)
    })
});

export const updateContentSchema = z.object({
    params: z.object({
        id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Неверный формат ID')
    }),
    body: z.object({
        productType: z.string().min(1, 'Тип продукта обязателен').optional(),
        productId: z.string().min(1, 'ID продукта обязателен').optional(),
        title: z.string()
            .min(1, 'Заголовок не может быть пустым')
            .max(200, 'Заголовок не может быть длиннее 200 символов')
            .trim()
            .optional(),
        description: z.string()
            .min(1, 'Описание не может быть пустым')
            .max(500, 'Описание не может быть длиннее 500 символов')
            .trim()
            .optional(),
        content: z.string()
            .min(1, 'Контент не может быть пустым')
            .trim()
            .optional(),
        isActive: z.boolean().optional()
    })
});

export const getContentSchema = z.object({
    params: z.object({
        id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Неверный формат ID')
    })
});

export const getActiveContentSchema = z.object({
    query: z.object({
        productType: z.string().min(1, 'productType is required'),
        productId: z.string().min(1, 'productId is required'),
    })
});

export const deleteContentSchema = z.object({
    params: z.object({
        id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Неверный формат ID')
    })
});

export type CreateContentInput = z.infer<typeof createContentSchema>['body'];
export type UpdateContentInput = z.infer<typeof updateContentSchema>['body'];
export type GetContentParams = z.infer<typeof getContentSchema>['params'];
export type GetActiveContentQuery = z.infer<typeof getActiveContentSchema>['query'];
export type DeleteContentParams = z.infer<typeof deleteContentSchema>['params'];