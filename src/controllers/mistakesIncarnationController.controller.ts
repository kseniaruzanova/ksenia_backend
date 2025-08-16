import { Request, Response } from "express";
import Content from "../models/content.model";

// Импортируем наши JSON-данные
import karmicLessonsData from "../data/mistakesIncarnation/karmicLessons.json";
import lessonIncarnationData from "../data/mistakesIncarnation/lessonIncarnation.json";

import { AppError } from "../middleware/errorHandler";
import { generateForecastPdf, generateMistakesIncarnationPdf } from "../services/pdfGenerator.service";

// Типизируем наши данные для большей надежности
type ArcanasData = { [key: string]: string };

const karmicLessonsMap: ArcanasData = karmicLessonsData;
const lessonIncarnationMap: ArcanasData = lessonIncarnationData;

const toArcana = (sum: number): number => {
  while (sum > 22) {
    sum -= 22;
  }
  return sum;
};

export const getMistakesIncarnation = async (req: Request, res: Response) => {
  const { birthDate } = req.body;

  const parts = birthDate.split(".");
  if (parts.length !== 3) { throw new AppError("Invalid date format. Expected DD.MM.YYYY", 400); }

  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);

  if (isNaN(day) || isNaN(month)) { throw new AppError("Invalid day or month in date", 400); }

  const lessonIncarnation: number = month;
  const karmicLessons: number = Math.abs(toArcana(day)-toArcana(month));

  // Получаем связанный контент
  const saleScriptContent = await Content.findOne({
    productType: 'mistakesIncarnation',
    productId: 'taroscope-mistakesIncarnation',
    isActive: true
  }).lean();

  const result = {
    mistakesIncarnation: {
      lessonIncarnation: lessonIncarnationMap[lessonIncarnation],
      karmicLessons: karmicLessonsMap[karmicLessons]
    },
    saleScript: saleScriptContent // Добавляем контент в ответ
  };

  res.status(200).json({
    status: "success",
    data: result,
  });
};

export const getMistakesIncarnationAsPdf = async (req: Request, res: Response) => {
    const { birthDate } = req.body;

    const parts = birthDate.split(".");
    if (parts.length !== 3) { throw new AppError("Invalid date format. Expected DD.MM.YYYY", 400); }

    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);

    if (isNaN(day) || isNaN(month)) { throw new AppError("Invalid day or month in date", 400); }

    const lessonIncarnation: number = month;
    const karmicLessons: number = Math.abs(toArcana(day)-toArcana(month));

    const mistakesIncarnationData = {
        lessonIncarnation: { arcanum: lessonIncarnation, text: lessonIncarnationMap[lessonIncarnation] || "" },
        karmicLessons: { arcanum: karmicLessons, text: karmicLessonsMap[karmicLessons] || "" }
    };
    
    const filename = `mistakesIncarnation_${birthDate.replace(/\./g, '-')}.pdf`;
    res.setHeader('Content-disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-type', 'application/pdf');

    const pdfData = {
        mistakesIncarnation: mistakesIncarnationData,
        saleScript: null,
    };

    generateMistakesIncarnationPdf(pdfData, res, birthDate);
};
