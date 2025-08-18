import { Request, Response } from "express";
import Content from "../models/content.model";

// Импортируем наши JSON-данные
import coreData from "../data/awakeningCodes/core.json";
import fearData from "../data/awakeningCodes/fear.json";
import implementationData from "../data/awakeningCodes/implementation.json";

import { AppError } from "../middleware/errorHandler";
import { generateAwakeningCodesPdf } from "../services/pdfGenerator.service";

// Типизируем наши данные для большей надежности
type ArcanasData = { [key: string]: string };

const coreMap: ArcanasData = coreData;
const fearMap: ArcanasData = fearData;
const implementationMap: ArcanasData = implementationData;

const toArcana = (sum: number): number => {
  while (sum > 22) {
    sum -= 22;
  }
  return sum;
};

export const getAwakeningCodes = async (req: Request, res: Response) => {
  const { birthDate } = req.body;

  const parts = birthDate.split(".");
  if (parts.length !== 3) { throw new AppError("Invalid date format. Expected DD.MM.YYYY", 400); }

  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const year = parts[2];

  if (isNaN(day) || isNaN(month)) { throw new AppError("Invalid day or month in date", 400); }

  const yearSum = year
    .split("")
    .reduce((acc: any, digit: any) => acc + parseInt(digit, 10), 0);

  const core: number = toArcana(day);
  const fear: number = toArcana(day+month);
  const implementation: number = toArcana(core+month+yearSum);

  // Получаем связанный контент
  const saleScriptContent = await Content.findOne({
    productType: 'awakeningCodes',
    productId: 'taroscope-awakeningCodes',
    isActive: true
  }).lean();

  const result = {
    awakeningCodes: {
      core: coreMap[core],
      fear: fearMap[fear],
      implementation: implementationMap[implementation]
    },
    saleScript: saleScriptContent // Добавляем контент в ответ
  };

  res.status(200).json({
    status: "success",
    data: result,
  });
};

export const getAwakeningCodesAsPdf = async (req: Request, res: Response) => {
    const { birthDate } = req.body;

    const parts = birthDate.split(".");
    if (parts.length !== 3) { throw new AppError("Invalid date format. Expected DD.MM.YYYY", 400); }

    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parts[2];

    if (isNaN(day) || isNaN(month)) { throw new AppError("Invalid day or month in date", 400); }

    const yearSum = year
      .split("")
      .reduce((acc: any, digit: any) => acc + parseInt(digit, 10), 0);

    const core: number = toArcana(day);
    const fear: number = toArcana(day+month);
    const implementation: number = toArcana(core+month+yearSum);
    
    const filename = `awakeningCodes_${birthDate.replace(/\./g, '-')}.pdf`;
    res.setHeader('Content-disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-type', 'application/pdf');

    const awakeningCodes = {
      core: { arcanum: core, text: coreMap[core] || "" },
      fear: { arcanum: fear, text: fearMap[fear] || "" },
      implementation: { arcanum: implementation, text: implementationMap[implementation] || "" }
    };

    const pdfData = {
      awakeningCodes: awakeningCodes,
      saleScript: null,
    };

    generateAwakeningCodesPdf(pdfData, res, birthDate);
};
