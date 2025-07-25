import { Request, Response } from "express";

// Импортируем наши JSON-данные
import monthsData from "../data/taroscop/months.json";
import yearDoorData from "../data/taroscop/yearDoor.json";
import riskData from "../data/taroscop/risk.json";
import eventsData from "../data/taroscop/events.json";
import { AppError } from "../middleware/errorHandler";
import { generateForecastPdf } from "../services/pdfGenerator";

// Типизируем наши данные для большей надежности
type ArcanasData = { [key: string]: string };

const monthsMap: ArcanasData = monthsData;
const yearDoorMap: ArcanasData = yearDoorData;
const riskMap: ArcanasData = riskData;
const eventsMap: ArcanasData = eventsData;

/**
 * Вспомогательная функция для приведения числа к диапазону 1-22.
 * Если число больше 22, из него вычитается 22 до тех пор, пока оно не попадет в диапазон.
 * @param sum - Исходное число
 * @returns Число от 1 до 22
 */
const toArcana = (sum: number): number => {
  while (sum > 22) {
    sum -= 22;
  }
  return sum;
};

/**
 * Контроллер для расчета и отправки прогноза
 */
export const getForecast = async (req: Request, res: Response) => {
  const { birthDate } = req.body;

  const parts = birthDate.split(".");
  if (parts.length !== 3) {
    throw new AppError("Invalid date format. Expected DD.MM.YYYY", 400);
  }

  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10); // Месяц рождения все еще нужен для "Двери года"
  const year = parts[2];

  if (isNaN(day) || isNaN(month)) {
    throw new AppError("Invalid day or month in date", 400);
  }

  // 1. Расчет Суммы чисел года (остается без изменений)
  const yearSum = year
    .split("")
    .reduce((acc: any, digit: any) => acc + parseInt(digit, 10), 0);

  // 2. Расчет аркана для "ДВЕРЬ ГОДА" (остается годовым)
  const rawYearDoorSum = day + month + yearSum + 9 + 10; // Используем month (месяц рождения)
  const yearDoorArcana = toArcana(rawYearDoorSum);

  // 3. Расчет аркана для "СОБЫТИЯ" (остается годовым)
  const rawEventsSum = day + 9 + 16;
  const eventsArcana = toArcana(rawEventsSum);

  // --- УДАЛЯЕМ ГОДОВОЙ РАСЧЕТ РИСКА ---
  // const rawRiskSum = day + month + yearSum + 9 + 18;
  // const riskArcana = toArcana(rawRiskSum);

  // 4. Расчет "МЕСЯЦЫ" на 7 месяцев вперед (ИЗМЕНЯЕМ ЭТОТ БЛОК)
  const monthNames = [
    "Январь",
    "Февраль",
    "Март",
    "Апрель",
    "Май",
    "Июнь",
    "Июль",
    "Август",
    "Сентябрь",
    "Октябрь",
    "Ноябрь",
    "Декабрь",
  ];
  const currentMonthIndex = new Date().getMonth();
  const monthlyForecasts = [];

  for (let i = 0; i < 7; i++) {
    const targetMonthIndex = (currentMonthIndex + i) % 12;
    const monthNumber = targetMonthIndex + 1; // Это ТЕКУЩИЙ месяц (1-12)

    // Расчет ЕЖЕМЕСЯЧНОГО ЭКЗАМЕНА
    const examArcana = toArcana(day + monthNumber);

    // Расчет ЕЖЕМЕСЯЧНОГО РИСКА (НОВАЯ ФОРМУЛА)
    // Вместо месяца рождения (month) используем текущий номер месяца (monthNumber)
    // Формула: (День + Номер_текущего_месяца + Сумма чисел года) + 9 + 18
    const rawRiskSum = day + monthNumber + yearSum + 9 + 18;
    const riskArcana = toArcana(rawRiskSum);

    monthlyForecasts.push({
      monthName: monthNames[targetMonthIndex],
      exam: {
        // Оборачиваем в объект для ясности
        arcanum: examArcana,
        text: monthsMap[examArcana] || "Трактовка не найдена",
      },
      risk: {
        // Добавляем риск в ежемесячный прогноз
        arcanum: riskArcana,
        text: riskMap[riskArcana] || "Трактовка не найдена",
      },
    });
  }

  // Формируем итоговый ответ
  const result = {
    yearDoor: {
      // Дверь года - годовой показатель
      arcanum: yearDoorArcana,
      text: yearDoorMap[yearDoorArcana] || "Трактовка не найдена",
    },
    // --- УДАЛЯЕМ РИСК ИЗ ГОДОВЫХ ПОКАЗАТЕЛЕЙ ---
    // risk: { ... },
    events: {
      // События - годовой показатель
      arcanum: eventsArcana,
      text: eventsMap[eventsArcana] || "Трактовка не найдена",
    },
    monthlyForecasts, // Здесь теперь и экзамен, и риск
  };

  res.status(200).json({
    status: "success",
    data: result,
  });
};

// НОВАЯ ФУНКЦИЯ ДЛЯ ГЕНЕРАЦИИ PDF
export const getForecastAsPdf = async (req: Request, res: Response) => {
    // 1. Получаем и валидируем дату (код такой же, как в getForecast)
    const { birthDate } = req.body;

    const parts = birthDate.split('.');
    if (parts.length !== 3) throw new AppError('Invalid date format. Expected DD.MM.YYYY', 400);

    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parts[2];

    if (isNaN(day) || isNaN(month)) throw new AppError('Invalid day or month in date', 400);
    
    // 2. Выполняем все расчеты (код такой же, как в getForecast)
    const yearSum = year.split('').reduce((acc: any, digit: any) => acc + parseInt(digit, 10), 0);
    const rawYearDoorSum = day + month + yearSum + 9 + 10;
    const yearDoorArcana = toArcana(rawYearDoorSum);
    const rawEventsSum = day + 9 + 16;
    const eventsArcana = toArcana(rawEventsSum);
    
    const monthNames = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
    const currentMonthIndex = new Date().getMonth();
    const monthlyForecasts = [];

    for (let i = 0; i < 7; i++) {
        const targetMonthIndex = (currentMonthIndex + i) % 12;
        const monthNumber = targetMonthIndex + 1;
        const examArcana = toArcana(day + monthNumber);
        const rawRiskSum = day + monthNumber + yearSum + 9 + 18;
        const riskArcana = toArcana(rawRiskSum);

        monthlyForecasts.push({
            monthName: monthNames[targetMonthIndex],
            exam: { arcanum: examArcana, text: monthsMap[examArcana] || "" },
            risk: { arcanum: riskArcana, text: riskMap[riskArcana] || "" }
        });
    }

    const forecastData = {
        yearDoor: { arcanum: yearDoorArcana, text: yearDoorMap[yearDoorArcana] || "" },
        events: { arcanum: eventsArcana, text: eventsMap[eventsArcana] || "" },
        monthlyForecasts,
    };
    
    // 3. Настраиваем HTTP-ответ для PDF
    const filename = `forecast_${birthDate.replace(/\./g, '-')}.pdf`;
    res.setHeader('Content-disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-type', 'application/pdf');

    // 4. Вызываем наш сервис для генерации PDF и передаем ему поток ответа
    generateForecastPdf(forecastData, res, birthDate);
};