import { z } from 'zod';

export const createContentSchema = z.object({
    body: z.object({
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

export const deleteContentSchema = z.object({
    params: z.object({
        id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Неверный формат ID')
    })
});

export type CreateContentInput = z.infer<typeof createContentSchema>['body'];
export type UpdateContentInput = z.infer<typeof updateContentSchema>['body'];
export type GetContentParams = z.infer<typeof getContentSchema>['params'];
export type DeleteContentParams = z.infer<typeof deleteContentSchema>['params'];