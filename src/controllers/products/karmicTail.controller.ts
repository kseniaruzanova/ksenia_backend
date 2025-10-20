import { Request, Response } from "express";

import { toArcana, splitNumberIntoDigits } from "../../utils/arcan";
import { ArcanasData } from "../../types/arcan";
import { AppError } from "../../interfaces/appError";
import { KarmicTailData } from "../../interfaces/arcan";
import { generateKarmicTailPdf } from "../../services/pdfGenerator.service";
import { trackProductRequest } from "../productStatistics.controller";
import { AuthRequest } from "../../interfaces/authRequest";

import karmicTailData from "../../data/karmicTail/karmicTail.json";
import destinyData from "../../data/karmicTail/destiny.json";
import moneyKarmaData from "../../data/karmicTail/moneyKarma.json";

const karmicTailMap: ArcanasData = karmicTailData;
const destinyMap: ArcanasData = destinyData;
const moneyKarmaMap: ArcanasData = moneyKarmaData;

export const getKarmicTail = async (req: AuthRequest, res: Response) => {
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

  // Расчет арканов
  const karmicTail: number = toArcana(day + month);
  const destiny: number = toArcana(day + month + yearSum);
  const moneyKarma: number = toArcana(toArcana(day) + month + splitNumberIntoDigits(yearSum)[0]);

  const result = {
    karmicTail: karmicTailMap[karmicTail] || "Трактовка не найдена",
    destiny: destinyMap[destiny] || "Трактовка не найдена",
    moneyKarma: moneyKarmaMap[moneyKarma] || "Трактовка не найдена"
  };

  // Трекинг запроса
  if (req.user?.customerId) {
    await trackProductRequest('karmicTail', req.user.customerId.toString(), birthDate, 'json');
  }

  res.status(200).json({
    status: "success",
    data: result,
  });
};

export const getKarmicTailAsPdf = async (req: AuthRequest, res: Response) => {
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

  // Расчет арканов
  const karmicTail: number = toArcana(day + month);
  const destiny: number = toArcana(day + month + yearSum);
  const moneyKarma: number = toArcana(toArcana(day) + month + splitNumberIntoDigits(yearSum)[0]);

  const karmicTailData: KarmicTailData = {
    karmicTail: { arcanum: karmicTail, text: karmicTailMap[karmicTail] || "" },
    destiny: { arcanum: destiny, text: destinyMap[destiny] || "" },
    moneyKarma: { arcanum: moneyKarma, text: moneyKarmaMap[moneyKarma] || "" }
  };

  // Трекинг запроса
  if (req.user?.customerId) {
    await trackProductRequest('karmicTail', req.user.customerId.toString(), birthDate, 'pdf');
  }
    
  const filename: string = `karmicTail_${birthDate.replace(/\./g, '-')}.pdf`;
  res.setHeader('Content-disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-type', 'application/pdf');

  generateKarmicTailPdf(karmicTailData, res, birthDate);
};

