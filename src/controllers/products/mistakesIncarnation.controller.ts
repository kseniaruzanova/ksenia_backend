import { Request, Response } from "express";

import karmicLessonsData from "../../data/mistakesIncarnation/karmicLessons.json";
import lessonIncarnationData from "../../data/mistakesIncarnation/lessonIncarnation.json";

import { generateMistakesIncarnationPdf } from "../../services/pdfGenerator.service";
import { ArcanasData } from "../../types/arcan";
import { AppError } from "../../interfaces/appError";
import { toArcana } from "../../utils/arcan";
import { MistakesIncarnationData } from "../../interfaces/arcan";
import { trackProductRequest } from "../productStatistics.controller";
import { AuthRequest } from "../../interfaces/authRequest";

const karmicLessonsMap: ArcanasData = karmicLessonsData;
const lessonIncarnationMap: ArcanasData = lessonIncarnationData;

export const getMistakesIncarnation = async (req: AuthRequest, res: Response) => {
  const { birthDate } = req.body;

  const parts: string[] = birthDate.split(".");
  if (parts.length !== 3) { 
    throw new AppError("Invalid date format. Expected DD.MM.YYYY", 400); 
  }

  const day: number = parseInt(parts[0], 10);
  const month: number = parseInt(parts[1], 10);

  if (isNaN(day) || isNaN(month)) { 
    throw new AppError("Invalid day or month in date", 400); 
  }

  const lessonIncarnation: number = month;
  const karmicLessons: number = Math.abs(toArcana(day)-toArcana(month));

  const mistakesIncarnationData = {
    lessonIncarnation: lessonIncarnationMap[lessonIncarnation],
    karmicLessons: karmicLessonsMap[karmicLessons]
  };

  // Трекинг запроса
  if (req.user?.customerId) {
    await trackProductRequest('mistakesIncarnation', req.user.customerId.toString(), birthDate, 'json');
  }

  res.status(200).json({
    status: "success",
    data: mistakesIncarnationData,
  });
};

export const getMistakesIncarnationAsPdf = async (req: AuthRequest, res: Response) => {
  const { birthDate } = req.body;

  const parts = birthDate.split(".");
  if (parts.length !== 3) { throw new AppError("Invalid date format. Expected DD.MM.YYYY", 400); }

  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);

  if (isNaN(day) || isNaN(month)) { throw new AppError("Invalid day or month in date", 400); }

  const lessonIncarnation: number = month;
  const karmicLessons: number = Math.abs(toArcana(day)-toArcana(month));

  const mistakesIncarnationData: MistakesIncarnationData = {
    lessonIncarnation: { arcanum: lessonIncarnation, text: lessonIncarnationMap[lessonIncarnation] || "" },
    karmicLessons: { arcanum: karmicLessons, text: karmicLessonsMap[karmicLessons] || "" }
  };
  
  // Трекинг запроса
  if (req.user?.customerId) {
    await trackProductRequest('mistakesIncarnation', req.user.customerId.toString(), birthDate, 'pdf');
  }

  const filename = `mistakesIncarnation_${birthDate.replace(/\./g, '-')}.pdf`;
  res.setHeader('Content-disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-type', 'application/pdf');

  generateMistakesIncarnationPdf(mistakesIncarnationData, res, birthDate);
};
