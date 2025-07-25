import { z } from "zod";

/**
 * Схема валидации для запроса на получение прогноза.
 * Проверяет, что в теле запроса есть поле `birthDate` в формате DD.MM.YYYY.
 */
export const forecastSchema = z.object({
  body: z.object({
    birthDate: z
      .string() // 1. Начинаем с базового типа string
      .min(1, { message: "birthDate is required" }) // 2. Убеждаемся, что строка не пустая (это замена required_error)
      .regex(
        /^\d{2}\.\d{2}\.\d{4}$/,
        { message: "Date must be in DD.MM.YYYY format" } // 3. Задаем сообщение для regex
      ),
  }),
});

/**
 * Тип для входящих данных (тела запроса), выведенный из схемы `forecastSchema`.
 * Позволяет использовать строгую типизацию в контроллере.
 */
export type ForecastInput = z.infer<typeof forecastSchema>["body"];
