import { z } from "zod";

export const arcanSchema: z.ZodObject = z.object({
  body: z.object({
    birthDate: z
      .string()
      .min(1, { message: "birthDate is required" })
      .regex(
        /^\d{2}\.\d{2}\.\d{4}$/,
        { message: "Date must be in DD.MM.YYYY format" }
      ),
  }),
});

export type ForecastInput = z.infer<typeof arcanSchema>["body"];
