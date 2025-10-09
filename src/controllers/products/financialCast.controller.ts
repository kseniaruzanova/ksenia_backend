import { Request, Response } from "express";

import { ArcanasData } from "../../types/arcan";
import { AppError } from "../../interfaces/appError";
import { FinancialCastData } from "../../interfaces/arcan";
import { splitNumberIntoDigits, toArcana } from "../../utils/arcan";
import { generateFinancialCastPdf } from "../../services/pdfGenerator.service";

import archetypePovertyData from "../../data/financialCast/archetypePoverty.json";
import dutyData from "../../data/financialCast/duty.json";
import knotData from "../../data/financialCast/knot.json";
import shadowBData from "../../data/financialCast/shadowB.json";
import ritualsData from "../../data/financialCast/rituals.json";

const archetypePovertyMap: ArcanasData = archetypePovertyData;
const dutyMap: ArcanasData = dutyData;
const knotMap: ArcanasData = knotData;
const shadowBMap: ArcanasData = shadowBData;
const ritualsMap: ArcanasData = ritualsData;

export const getFinancialCast = async (req: Request, res: Response) => {
  const { birthDate } = req.body;

  const financialCastData: FinancialCastData = getFinancialCastData(birthDate);

  res.status(200).json({
    status: "success",
    data: financialCastData,
  });
};

export const getFinancialCastAsPdf = async (req: Request, res: Response) => {
  const { birthDate } = req.body;

  const financialCastData: FinancialCastData = getFinancialCastData(birthDate);
    
  const filename: string = `financialCast_${birthDate.replace(/\./g, '-')}.pdf`;
  res.setHeader('Content-disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-type', 'application/pdf');

  generateFinancialCastPdf(financialCastData, res, birthDate);
};

function getFinancialCastData(birthDate: string): FinancialCastData {
  const parts: string[] = birthDate.split(".");
  if (parts.length !== 3) {
    throw new AppError('Invalid date format. Expected DD.MM.YYYY', 400);
  }

  const day: number = parseInt(parts[0], 10);
  const month: number = parseInt(parts[1], 10);
  const year: string = parts[2];

  if (isNaN(day) || isNaN(month)) {
    throw new AppError('Invalid day or month in date', 400); 
  }

  const yearSum: number = year
    .split("")
    .reduce((acc: any, digit: any) => acc + parseInt(digit, 10), 0);

  const arcanRealization: number = toArcana(day)+month+splitNumberIntoDigits(yearSum)[0];
  const arcanMainBlock: number = toArcana(day)+splitNumberIntoDigits(month)[0];
  
  const moneyKnot: number = toArcana(arcanRealization+arcanMainBlock);
  const archetypePoverty: number = toArcana(toArcana(day)+month);
  const duty: number = toArcana(day+splitNumberIntoDigits(month)[0]+yearSum+8);
  const shadowWealth: number = toArcana(day+month+yearSum);

  return {
    moneyKnot: {
      arcanum: moneyKnot,
      text: knotMap[moneyKnot] || "Трактовка не найдена",
    },
    archetypePoverty: {
      arcanum: archetypePoverty,
      text: archetypePovertyMap[archetypePoverty] || "Трактовка не найдена",
    },
    duty: {
      arcanum: duty,
      text: dutyMap[duty] || "Трактовка не найдена",
    },
    shadowWealth: {
      arcanum: shadowWealth,
      text: shadowBMap[shadowWealth] || "Трактовка не найдена",
    },
    ritualsMap: Object.entries(ritualsMap).map(([title, text]) => ({
      title,
      text,
    }))
  };
}
