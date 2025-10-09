import { z } from "zod";

import { isMongoId } from '../../utils/validators';

export const sendMessageSocketSchema = z.object({
    chatId: z.string().refine(isMongoId, { message: 'Invalid chat ID' }),
    content: z.string().min(1, 'Message content cannot be empty'),
});

export const typingSocketSchema = z.object({
    chatId: z.string().refine(isMongoId, { message: 'Invalid chat ID' }),
});

export const messageStatusSocketSchema = z.object({
    messageId: z.string().refine(isMongoId, { message: 'Invalid message ID' }),
    chatId: z.string().refine(isMongoId, { message: 'Invalid chat ID' }),
}); 
