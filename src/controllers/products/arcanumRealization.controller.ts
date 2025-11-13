import fs from "fs";

import { Request, Response } from "express";
import { AppError } from "../../interfaces/appError";
import { getArcanFilePath, toArcana } from "../../utils/arcan";
import { trackProductRequest } from "../productStatistics.controller";
import { AuthRequest } from "../../interfaces/authRequest";

export const getArcanumRealizationAsPdf = async (req: AuthRequest, res: Response) => {
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

  const finalNumber: number = toArcana(day+month+yearSum);
  
  const arcanFilePath = getArcanFilePath(finalNumber, __dirname, ["..", "..", "src", "data", "arcanumRealization"]);

  console.log(arcanFilePath);
  
  // Трекинг запроса
  if (req.user?.customerId) {
    await trackProductRequest('arcanumRealization', req.user.customerId.toString(), birthDate, 'pdf');
  }

  const filename: string = `arcanumRealization_${birthDate.replace(/\./g, "-")}.pdf`;
  res.setHeader("Content-disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-type", "application/pdf");

  const fileStream: fs.ReadStream = fs.createReadStream(arcanFilePath);
  fileStream.pipe(res);
};
