import { Request, Response } from "express";

import { toArcana } from "../../utils/arcan";
import { ArcanasData } from "../../types/arcan";
import { AppError } from "../../interfaces/appError";
import { MatrixLife, MatrixLifeData } from "../../interfaces/arcan";
import { generateMatrixLifePdf } from "../../services/pdfGenerator.service";
import { trackProductRequest } from "../productStatistics.controller";
import { AuthRequest } from "../../interfaces/authRequest";


export const getMatrixLife = async (req: AuthRequest, res: Response) => {
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

  const result: MatrixLife = {

  };

  // Трекинг запроса
  if (req.user?.customerId) {
    await trackProductRequest('matrixLife', req.user.customerId.toString(), birthDate, 'json');
  }

  res.status(200).json({
    status: "success",
    data: result,
  });
};

export const getMatrixLifeAsPdf = async (req: AuthRequest, res: Response) => {
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

  const matrixLife: MatrixLifeData = {

  };
  
  // Трекинг запроса
  if (req.user?.customerId) {
    await trackProductRequest('matrixLife', req.user.customerId.toString(), birthDate, 'pdf');
  }
    
  const filename: string = `matrixLife_${birthDate.replace(/\./g, '-')}.pdf`;
  res.setHeader('Content-disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-type', 'application/pdf');

  generateMatrixLifePdf(matrixLife, res, birthDate);
};
