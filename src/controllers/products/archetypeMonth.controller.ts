import { Response } from "express";

import { AppError } from "../../interfaces/appError";
import { AuthRequest } from "../../interfaces/authRequest";
import { ArcanasData } from "../../types/arcan";
import { ArchetypeMonthData } from "../../interfaces/arcan";
import { trackProductRequest } from "../productStatistics.controller";
import { generateArchetypeMonthPdf } from "../../services/pdfGenerator.service";

import interpretationsData from "../../data/archetypeMonth/interpretations.json";

const interpretationsMap: ArcanasData = interpretationsData;

export const getArchetypeMonthAsPdf = async (req: AuthRequest, res: Response) => {
  const { birthDate, chooseMonth } = req.body;

  if (!birthDate || typeof birthDate !== "string") {
    throw new AppError("birthDate is required", 400);
  }

  const parts: string[] = birthDate.split(".");
  if (parts.length !== 3) {
    throw new AppError("Invalid date format. Expected DD.MM.YYYY", 400);
  }

  const day: number = parseInt(parts[0], 10);
  const month: number = parseInt(parts[1], 10);

  if (isNaN(day) || isNaN(month)) { 
    throw new AppError("Invalid day or month in date", 400); 
  }

  // Функция для расчета аркана по вашей формуле
  const calculateArcana = (a2: number, b2: number, c2: number): number => {
    const sum = a2 + b2 + c2 + 2 + 0 + 2 + 5;
    
    if (sum > 22) {
      const sumStr = sum.toString();
      const leftDigit = parseInt(sumStr.charAt(0), 10);
      const rightDigit = parseInt(sumStr.charAt(sumStr.length - 1), 10);
      return leftDigit + rightDigit;
    } else {
      return sum;
    }
  };

  const arcana = calculateArcana(day, month, chooseMonth);

  if (req.user?.customerId) {
    await trackProductRequest("archetypeMonth", req.user.customerId.toString(), birthDate, "pdf");
  }

  const filename: string = `archetypeMonth_${birthDate.replace(/\./g, "-")}.pdf`;
  res.setHeader("Content-disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-type", "application/pdf");

  const data: ArchetypeMonthData = {
    archetype: {
      arcanum: arcana,
      text: interpretationsMap[arcana] || "Трактовка не найдена",
    },
  };

  generateArchetypeMonthPdf(data, res, birthDate);
};




