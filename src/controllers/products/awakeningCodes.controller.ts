import { Request, Response } from "express";

import { toArcana } from "../../utils/arcan";
import { ArcanasData } from "../../types/arcan";
import { AppError } from "../../interfaces/appError";
import { AwakeningCodesData, AwakeningCodes } from "../../interfaces/arcan";
import { generateAwakeningCodesPdf } from "../../services/pdfGenerator.service";

import coreData from "../../data/awakeningCodes/core.json";
import fearData from "../../data/awakeningCodes/fear.json";
import implementationData from "../../data/awakeningCodes/implementation.json";

const coreMap: ArcanasData = coreData;
const fearMap: ArcanasData = fearData;
const implementationMap: ArcanasData = implementationData;

export const getAwakeningCodes = async (req: Request, res: Response) => {
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

  const core: number = toArcana(day);
  const fear: number = toArcana(day+month);
  const implementation: number = toArcana(core+month+yearSum);

  const result: AwakeningCodes = {
    core: coreMap[core],
    fear: fearMap[fear],
    implementation: implementationMap[implementation]
  };

  res.status(200).json({
    status: "success",
    data: result,
  });
};

export const getAwakeningCodesAsPdf = async (req: Request, res: Response) => {
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

  const core: number = toArcana(day);
  const fear: number = toArcana(day+month);
  const implementation: number = toArcana(core+month+yearSum);
    
  const filename: string = `awakeningCodes_${birthDate.replace(/\./g, '-')}.pdf`;
  res.setHeader('Content-disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-type', 'application/pdf');

  const awakeningCodes: AwakeningCodesData = {
    core: { arcanum: core, text: coreMap[core] || "" },
    fear: { arcanum: fear, text: fearMap[fear] || "" },
    implementation: { arcanum: implementation, text: implementationMap[implementation] || "" }
  };

  generateAwakeningCodesPdf(awakeningCodes, res, birthDate);
};
