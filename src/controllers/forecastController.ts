import { Request, Response } from "express";
import Content from "../models/content.model";

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

const toArcana = (sum: number): number => {
  while (sum > 22) {
    sum -= 22;
  }
  return sum;
};

export const getForecast = async (req: Request, res: Response) => {
  const { birthDate } = req.body;

  const parts = birthDate.split(".");
  if (parts.length !== 3) {
    throw new AppError("Invalid date format. Expected DD.MM.YYYY", 400);
  }

  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const year = parts[2];

  if (isNaN(day) || isNaN(month)) {
    throw new AppError("Invalid day or month in date", 400);
  }

  const yearSum = year
    .split("")
    .reduce((acc: any, digit: any) => acc + parseInt(digit, 10), 0);

  const rawYearDoorSum = day + month + yearSum + 9 + 10;
  const yearDoorArcana = toArcana(rawYearDoorSum);

  const rawEventsSum = day + 9 + 16;
  const eventsArcana = toArcana(rawEventsSum);

  const monthNames = [
    "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
    "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
  ];
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
      exam: {
        arcanum: examArcana,
        text: monthsMap[examArcana] || "Трактовка не найдена",
      },
      risk: {
        arcanum: riskArcana,
        text: riskMap[riskArcana] || "Трактовка не найдена",
      },
    });
  }

  // Получаем связанный контент
  const saleScriptContent = await Content.findOne({
    productType: 'forecast',
    productId: 'taroscope-main',
    isActive: true
  }).lean();

  const result = {
    forecast: {
      yearDoor: {
        arcanum: yearDoorArcana,
        text: yearDoorMap[yearDoorArcana] || "Трактовка не найдена",
      },
      events: {
        arcanum: eventsArcana,
        text: eventsMap[eventsArcana] || "Трактовка не найдена",
      },
      monthlyForecasts,
    },
    saleScript: saleScriptContent // Добавляем контент в ответ
  };

  res.status(200).json({
    status: "success",
    data: result,
  });
};

export const getForecastAsPdf = async (req: Request, res: Response) => {
    const { birthDate } = req.body;

    const parts = birthDate.split('.');
    if (parts.length !== 3) throw new AppError('Invalid date format. Expected DD.MM.YYYY', 400);

    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parts[2];

    if (isNaN(day) || isNaN(month)) throw new AppError('Invalid day or month in date', 400);
    
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

    // Получаем связанный контент для PDF
    const saleScriptContent = await Content.findOne({
      productType: 'forecast',
      productId: 'taroscope-main',
      isActive: true
    }).lean();
    
    const filename = `forecast_${birthDate.replace(/\./g, '-')}.pdf`;
    res.setHeader('Content-disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-type', 'application/pdf');

    const pdfData = {
        forecast: forecastData,
        saleScript: saleScriptContent,
    };

    generateForecastPdf(pdfData, res, birthDate);
};