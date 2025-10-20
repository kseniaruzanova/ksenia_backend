import { Request, Response } from "express";

import { ArcanasData } from "../../types/arcan";
import { AppError } from "../../interfaces/appError";
import { toArcana } from "../../utils/arcan";
import { ForecastData, MonthlyForecast } from "../../interfaces/arcan";
import { generateForecastPdf } from "../../services/pdfGenerator.service";
import { trackProductRequest } from "../productStatistics.controller";
import { AuthRequest } from "../../interfaces/authRequest";

import monthsData from "../../data/taroscop/months.json";
import yearDoorData from "../../data/taroscop/yearDoor.json";
import riskData from "../../data/taroscop/risk.json";
import eventsData from "../../data/taroscop/events.json";

const monthsMap: ArcanasData = monthsData;
const yearDoorMap: ArcanasData = yearDoorData;
const riskMap: ArcanasData = riskData;
const eventsMap: ArcanasData = eventsData;

const monthNames: string[] = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
];

export const getForecast = async (req: AuthRequest, res: Response) => {
  const { birthDate } = req.body;

  const forecastData: ForecastData = getForecastData(birthDate);

  // Трекинг запроса
  if (req.user?.customerId) {
    await trackProductRequest('forecast', req.user.customerId.toString(), birthDate, 'json');
  }

  res.status(200).json({
    status: "success",
    data: forecastData,
  });
};

export const getForecastAsPdf = async (req: AuthRequest, res: Response) => {
  const { birthDate } = req.body;

  const forecastData: ForecastData = getForecastData(birthDate);
    
  // Трекинг запроса
  if (req.user?.customerId) {
    await trackProductRequest('forecast', req.user.customerId.toString(), birthDate, 'pdf');
  }

  const filename: string = `forecast_${birthDate.replace(/\./g, '-')}.pdf`;
  res.setHeader('Content-disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-type', 'application/pdf');

  generateForecastPdf(forecastData, res, birthDate);
};

function getForecastData(birthDate: string): ForecastData {
  const parts = birthDate.split(".");
  if (parts.length !== 3) {
    throw new AppError("Invalid date format. Expected DD.MM.YYYY", 400);
  }

  const day: number = parseInt(parts[0], 10);
  const month: number = parseInt(parts[1], 10);
  const year: string = parts[2];

  if (isNaN(day) || isNaN(month)) {
    throw new AppError("Invalid day or month in date", 400);
  }

  const yearSum: number = year
    .split("")
    .reduce((acc: any, digit: any) => acc + parseInt(digit, 10), 0);

  const rawYearDoorSum: number = day + month + yearSum + 9 + 10;
  const yearDoorArcana: number = toArcana(rawYearDoorSum);

  const rawEventsSum: number = day + 9 + 16;
  const eventsArcana: number = toArcana(rawEventsSum);

  const currentMonthIndex: number = new Date().getMonth();
  const monthlyForecasts: MonthlyForecast[] = [];

  for (let i = 0; i < 7; i++) {
    const targetMonthIndex: number = (currentMonthIndex + i) % 12;
    const monthNumber: number = targetMonthIndex + 1;
    const examArcana: number = toArcana(day + monthNumber);
    const rawRiskSum: number = day + monthNumber + yearSum + 9 + 18;
    const riskArcana: number = toArcana(rawRiskSum);

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

  return {
    yearDoor: {
      arcanum: yearDoorArcana,
      text: yearDoorMap[yearDoorArcana] || "Трактовка не найдена",
    },
    events: {
      arcanum: eventsArcana,
      text: eventsMap[eventsArcana] || "Трактовка не найдена",
    },
    monthlyForecasts,
  };
}
