import { z } from 'zod';

import { isMongoId } from '../../utils/validators';

export const searchUsersSchema: z.ZodObject = z.object({
    query: z.object({
        q: z.string().min(1, 'Query cannot be empty'),
    }),
});

export const addContactSchema: z.ZodObject = z.object({
    body: z.object({
        contactId: z.string().refine(isMongoId, { message: 'Invalid contact ID' }),
    }),
});

export const removeContactSchema: z.ZodObject = z.object({
    params: z.object({
        id: z.string().refine(isMongoId, { message: 'Invalid contact ID' }),
    }),
});

export const updatePrivacySettingsSchema: z.ZodObject = z.object({
    body: z.object({
        allowSearch: z.string().optional().refine(val => !val || ['everyone', 'contacts', 'nobody'].includes(val), {
            message: "Invalid value for allowSearch. Must be one of 'everyone', 'contacts', 'nobody'."
        }),
        allowMessages: z.string().optional().refine(val => !val || ['everyone', 'contacts'].includes(val), {
            message: "Invalid value for allowMessages. Must be one of 'everyone', 'contacts'."
        }),
        birthDateVisibility: z.string().optional().refine(val => !val || ['everyone', 'contacts', 'nobody'].includes(val), {
            message: "Invalid value for birthDateVisibility. Must be one of 'everyone', 'contacts', 'nobody'."
        }),
    }).refine(data => Object.keys(data).length > 0, {
        message: "At least one privacy setting must be provided for update."
    })
});

export const addToBlacklistSchema: z.ZodObject = z.object({
    body: z.object({
        userId: z.string().refine((val: string) => isMongoId(val), {
            message: 'Invalid user ID',
        }),
    }),
});

export const removeFromBlacklistSchema: z.ZodObject = z.object({
    params: z.object({
        id: z.string().refine((val: string) => isMongoId(val), {
            message: 'Invalid user ID',
        }),
    }),
});

export const getUserByIdSchema: z.ZodObject = z.object({
    params: z.object({
        id: z.string().refine((val: string) => isMongoId(val), {
            message: 'Invalid user ID',
        }),
    }),
});

export const updateUserProfileSchema: z.ZodObject = z.object({
    body: z.object({
        about: z.string()
            .max(500, 'About text cannot be more than 500 characters')
            .optional(),
        website: z.string()
            .url({ message: "Invalid URL format" })
            .optional(),
        birthDate: z.string()
            .refine((date) => !date || !isNaN(Date.parse(date)), {
                message: "Invalid date format",
            })
            .optional(),
    }).refine(body => Object.keys(body).length > 0, {
        message: 'At least one field must be provided to update.'
    })
}); 
