import { object, string } from 'zod';
import { Types } from 'mongoose';

const isMongoId = (id: string) => Types.ObjectId.isValid(id);

// GET /users/search
export const searchUsersSchema = object({
    query: object({
        q: string().min(1, 'Query cannot be empty'),
    }),
});

// POST /users/contacts
export const addContactSchema = object({
    body: object({
        contactId: string().refine(isMongoId, { message: 'Invalid contact ID' }),
    }),
});

// DELETE /users/contacts/:id
export const removeContactSchema = object({
    params: object({
        id: string().refine(isMongoId, { message: 'Invalid contact ID' }),
    }),
});

export const updatePrivacySettingsSchema = object({
    body: object({
        allowSearch: string().optional().refine(val => !val || ['everyone', 'contacts', 'nobody'].includes(val), {
            message: "Invalid value for allowSearch. Must be one of 'everyone', 'contacts', 'nobody'."
        }),
        allowMessages: string().optional().refine(val => !val || ['everyone', 'contacts'].includes(val), {
            message: "Invalid value for allowMessages. Must be one of 'everyone', 'contacts'."
        }),
        birthDateVisibility: string().optional().refine(val => !val || ['everyone', 'contacts', 'nobody'].includes(val), {
            message: "Invalid value for birthDateVisibility. Must be one of 'everyone', 'contacts', 'nobody'."
        }),
    }).refine(data => Object.keys(data).length > 0, {
        message: "At least one privacy setting must be provided for update."
    })
});

export const addToBlacklistSchema = object({
    body: object({
        userId: string().refine((val) => Types.ObjectId.isValid(val), {
            message: 'Invalid user ID',
        }),
    }),
});

export const removeFromBlacklistSchema = object({
    params: object({
        id: string().refine((val) => Types.ObjectId.isValid(val), {
            message: 'Invalid user ID',
        }),
    }),
});

export const getUserByIdSchema = object({
    params: object({
        id: string().refine((val) => Types.ObjectId.isValid(val), {
            message: 'Invalid user ID',
        }),
    }),
});

export const updateUserProfileSchema = object({
    body: object({
        about: string()
            .max(500, 'About text cannot be more than 500 characters')
            .optional(),
        website: string()
            .url({ message: "Invalid URL format" })
            .optional(),
        birthDate: string()
            .refine((date) => !date || !isNaN(Date.parse(date)), {
                message: "Invalid date format",
            })
            .optional(),
    }).refine(body => Object.keys(body).length > 0, {
        message: 'At least one field must be provided to update.'
    })
}); 