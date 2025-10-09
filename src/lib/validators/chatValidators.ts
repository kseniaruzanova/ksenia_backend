import { z } from "zod";

import { isMongoId } from "../../utils/validators";

export const createPrivateChatSchema: z.ZodObject = z.object({
    body: z.object({
        participantId: z.string().refine(isMongoId, { message: 'Invalid participant ID' }),
    })
});

export const getChatMessagesSchema: z.ZodObject = z.object({
    params: z.object({
        id: z.string().refine(isMongoId, { message: 'Invalid chat ID' }),
    }),
    query: z.object({
        page: z.preprocess(
            (val) => parseInt(z.string().parse(val), 10),
            z.number().min(1).optional().default(1)
        ),
        limit: z.preprocess(
            (val) => parseInt(z.string().parse(val), 10),
            z.number().min(1).max(100).optional().default(50)
        ),
    })
});
