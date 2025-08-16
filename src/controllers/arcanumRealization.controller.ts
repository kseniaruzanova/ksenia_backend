import path from 'path';

import { Request, Response } from "express";

import { AppError } from "../middleware/errorHandler";

const toArcana = (sum: number): number => {
  while (sum > 22) {
    sum -= 22;
  }
  return sum;
};

export const getArcanumRealizationAsPdf = async (req: Request, res: Response) => {
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

  const finalNumber: number = toArcana(day+month+yearSum);
  
  const arcanFilePath = path.join(__dirname, 'src', 'data', 'arcanumRealization', `arcan_${finalNumber}.pdf`);

  const filename = `arcanumRealization_${birthDate.replace(/\./g, '-')}.pdf`;
  res.setHeader('Content-disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-type', 'application/pdf');
    
  res.sendFile(arcanFilePath);
};
