import { Request, Response } from "express";

import { ArcanasData } from "../../types/arcan";
import { AppError } from "../../interfaces/appError";
import { LifeMatrixData, LifePeriod } from "../../interfaces/arcan";
import { AuthRequest } from "../../interfaces/authRequest";
import { getBirthDateSum, summatioNumber, toArcana } from "../../utils/arcan";
import { trackProductRequest } from "../productStatistics.controller";
import { generateLifeMatrixPdf } from "../../services/pdfGenerator.service";

import birthDayData from "../../data/lifeMatrix/birthDayArcanum.json";
import yearData from "../../data/lifeMatrix/yearArcanum.json";
import higherForcesData from "../../data/lifeMatrix/higherForcesTaskArcanum.json";
import incarnationData from "../../data/lifeMatrix/incarnationLesson.json";
import selfRealizationData from "../../data/lifeMatrix/selfRealizationArcanum.json";
import positiveEventsData from "../../data/lifeMatrix/positiveEvents.json";
import karmicLessonsData from "../../data/lifeMatrix/karmicLessons.json";

const birthDayMap: ArcanasData = birthDayData;
const yearMap: ArcanasData = yearData;
const higherForcesMap: ArcanasData = higherForcesData;
const incarnationMap: ArcanasData = incarnationData;
const selfRealizationMap: ArcanasData = selfRealizationData;
const positiveEventsMap: ArcanasData = positiveEventsData;
const karmicLessonsMap: ArcanasData = karmicLessonsData;

export const getLifeMatrix = async (req: AuthRequest, res: Response) => {
  const { birthDate } = req.body;

  const parts: string[] = birthDate.split(".");
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
  
  // Расчет матрицы (по аналогии с matrixLife)
  const a = toArcana(toArcana(day)+month);
  const b = toArcana(toArcana(yearSum)+toArcana(day));

  const c = toArcana(a+b);
  const d = toArcana(month+yearSum);

  const secondA = Math.abs(day-month);
  const secondB = Math.abs(day-toArcana(yearSum));
  const secondC = Math.abs(secondA-secondB);
  const secondD = Math.abs(month-yearSum) === 22 ? 0 : Math.abs(month-yearSum);

  const matrix: number[][] = [
    [toArcana(day), toArcana(month), toArcana(yearSum), toArcana(getBirthDateSum(birthDate)), toArcana(day+month+yearSum)],
    [a, b, c, d, toArcana(a+b+c+d)],
    [secondA, secondB, secondC, secondD, toArcana(secondA+secondB+secondC+secondD)]
  ];

  // Аркан дня рождения
  const birthDayArcanum = toArcana(day);
  
  // Аркан года
  const yearArcanum = toArcana(yearSum);
  
  // Аркан задачи высших сил
  const higherForcesTaskArcanum = toArcana(getBirthDateSum(birthDate));
  
  // Урок на это воплощение
  const incarnationLesson = toArcana(month);
  
  // Аркан самореализации
  const selfRealizationArcanum = toArcana(day + month + yearSum);
  
  const summationDestinies = summatioNumber(getBirthDateSum(birthDate));

  const lifePeriods: LifePeriod[] = [
    {
      periodNumber: 1,
      fromAge: 0,
      toAge: 36 - summationDestinies,
      positiveEvents: positiveEventsMap[a],
      karmicLessons: karmicLessonsMap[secondA],
    },
    {
      periodNumber: 2,
      fromAge: 36 - summationDestinies,
      toAge: (36 - summationDestinies) + 9,
      positiveEvents: positiveEventsMap[b],
      karmicLessons: karmicLessonsMap[secondB],
    },
    {
      periodNumber: 3,
      fromAge: (36 - summationDestinies) + 9,
      toAge: (36 - summationDestinies) + 9 + 9,
      positiveEvents: positiveEventsMap[c],
      karmicLessons: karmicLessonsMap[secondC],
    },
    {
      periodNumber: 4,
      fromAge: (36 - summationDestinies) + 9 + 9,
      toAge: (36 - summationDestinies) + 9 + 9 + 9,
      positiveEvents: positiveEventsMap[d],
      karmicLessons: karmicLessonsMap[secondD],
    },
    {
      periodNumber: 5,
      fromAge: (36 - summationDestinies) + 9 + 9 + 9,
      toAge: "...",
      positiveEvents: positiveEventsMap[toArcana(a+b+c+d)],
      karmicLessons: karmicLessonsMap[toArcana(secondA+secondB+secondC+secondD)],
    }
  ];

  const result: LifeMatrixData = {
    matrix,
    birthDayArcanum: {
      arcanum: birthDayArcanum,
      text: birthDayMap[birthDayArcanum.toString()] || "Трактовка не найдена"
    },
    yearArcanum: {
      arcanum: yearArcanum,
      text: yearMap[yearArcanum.toString()] || "Трактовка не найдена"
    },
    higherForcesTaskArcanum: {
      arcanum: higherForcesTaskArcanum,
      text: higherForcesMap[higherForcesTaskArcanum.toString()] || "Трактовка не найдена"
    },
    incarnationLesson: {
      arcanum: incarnationLesson,
      text: incarnationMap[incarnationLesson.toString()] || "Трактовка не найдена"
    },
    selfRealizationArcanum: {
      arcanum: selfRealizationArcanum,
      text: selfRealizationMap[selfRealizationArcanum.toString()] || "Трактовка не найдена"
    },
    lifePeriods
  };

  // Трекинг запроса
  if (req.user?.customerId) {
    await trackProductRequest('lifeMatrix', req.user.customerId.toString(), birthDate, 'json');
  }

  res.status(200).json({
    status: "success",
    data: result,
  });
};

export const getLifeMatrixAsPdf = async (req: AuthRequest, res: Response) => {
  const { birthDate } = req.body;

  const parts: string[] = birthDate.split(".");
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
  
  // Расчет матрицы
  const a = toArcana(toArcana(day)+month);
  const b = toArcana(toArcana(yearSum)+toArcana(day));

  const c = toArcana(a+b);
  const d = toArcana(month+yearSum);

  const secondA = Math.abs(day-month);
  const secondB = Math.abs(day-toArcana(yearSum));
  const secondC = Math.abs(secondA-secondB);
  const secondD = Math.abs(month-yearSum) === 22 ? 0 : Math.abs(month-yearSum);

  const matrix: number[][] = [
    [toArcana(day), toArcana(month), toArcana(yearSum), toArcana(getBirthDateSum(birthDate)), toArcana(day+month+yearSum)],
    [a, b, c, d, toArcana(a+b+c+d)],
    [secondA, secondB, secondC, secondD, toArcana(secondA+secondB+secondC+secondD)]
  ];

  // Аркан дня рождения
  const birthDayArcanum = toArcana(day);
  
  // Аркан года
  const yearArcanum = toArcana(yearSum);
  
  // Аркан задачи высших сил
  const higherForcesTaskArcanum = toArcana(getBirthDateSum(birthDate));
  
  // Урок на это воплощение
  const incarnationLesson = toArcana(month);
  
  // Аркан самореализации
  const selfRealizationArcanum = toArcana(day + month + yearSum);
  
  const summationDestinies = summatioNumber(getBirthDateSum(birthDate));

  const lifePeriods: LifePeriod[] = [
    {
      periodNumber: 1,
      fromAge: 0,
      toAge: 36 - summationDestinies,
      positiveEvents: positiveEventsMap[a],
      karmicLessons: karmicLessonsMap[secondA],
    },
    {
      periodNumber: 2,
      fromAge: 36 - summationDestinies,
      toAge: (36 - summationDestinies) + 9,
      positiveEvents: positiveEventsMap[b],
      karmicLessons: karmicLessonsMap[secondB],
    },
    {
      periodNumber: 3,
      fromAge: (36 - summationDestinies) + 9,
      toAge: (36 - summationDestinies) + 9 + 9,
      positiveEvents: positiveEventsMap[c],
      karmicLessons: karmicLessonsMap[secondC],
    },
    {
      periodNumber: 4,
      fromAge: (36 - summationDestinies) + 9 + 9,
      toAge: (36 - summationDestinies) + 9 + 9 + 9,
      positiveEvents: positiveEventsMap[d],
      karmicLessons: karmicLessonsMap[secondD],
    },
    {
      periodNumber: 5,
      fromAge: (36 - summationDestinies) + 9 + 9 + 9,
      toAge: "...",
      positiveEvents: positiveEventsMap[toArcana(a+b+c+d)],
      karmicLessons: karmicLessonsMap[toArcana(secondA+secondB+secondC+secondD)],
    }
  ];

  const lifeMatrix: LifeMatrixData = {
    matrix,
    birthDayArcanum: {
      arcanum: birthDayArcanum,
      text: birthDayMap[birthDayArcanum.toString()] || "Трактовка не найдена"
    },
    yearArcanum: {
      arcanum: yearArcanum,
      text: yearMap[yearArcanum.toString()] || "Трактовка не найдена"
    },
    higherForcesTaskArcanum: {
      arcanum: higherForcesTaskArcanum,
      text: higherForcesMap[higherForcesTaskArcanum.toString()] || "Трактовка не найдена"
    },
    incarnationLesson: {
      arcanum: incarnationLesson,
      text: incarnationMap[incarnationLesson.toString()] || "Трактовка не найдена"
    },
    selfRealizationArcanum: {
      arcanum: selfRealizationArcanum,
      text: selfRealizationMap[selfRealizationArcanum.toString()] || "Трактовка не найдена"
    },
    lifePeriods
  };
  
  // Трекинг запроса
  if (req.user?.customerId) {
    await trackProductRequest('lifeMatrix', req.user.customerId.toString(), birthDate, 'pdf');
  }
    
  const filename: string = `lifeMatrix_${birthDate.replace(/\./g, '-')}.pdf`;
  res.setHeader('Content-disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-type', 'application/pdf');

  generateLifeMatrixPdf(lifeMatrix, res, birthDate);
};

