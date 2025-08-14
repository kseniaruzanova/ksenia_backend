import { Request, Response } from "express";
import Content from "../models/content.model";

// Импортируем наши JSON-данные
import archetypePovertyData from "../data/financialCast/archetypePoverty.json";
import dutyData from "../data/financialCast/duty.json";
import knotData from "../data/financialCast/knot.json";
import shadowBData from "../data/financialCast/shadowB.json";
import ritualsData from "../data/financialCast/rituals.json";

import { AppError } from "../middleware/errorHandler";
import { generateFinancialCastPdf } from "../services/pdfGenerator";

// Типизируем наши данные для большей надежности
type ArcanasData = { [key: string]: string };

const archetypePovertyMap: ArcanasData = archetypePovertyData;
const dutyMap: ArcanasData = dutyData;
const knotMap: ArcanasData = knotData;
const shadowBMap: ArcanasData = shadowBData;

const ritualsMap: ArcanasData = ritualsData;

const toArcana = (sum: number): number => {
  while (sum > 22) {
    sum -= 22;
  }
  return sum;
};

const splitNumberIntoDigits = (num: number): number[] => {
  const str = num.toString();
  const digits = str.split('').map(Number);
  
  if (digits.length === 1) {
    return [digits[0], 0]; // Добавляем 0 в конец для однозначных чисел
  } else {
    return digits.slice(0, 2); // Берём первые 2 цифры (если число длиннее)
  }
}

export const getFinancialCast = async (req: Request, res: Response) => {
  const { birthDate } = req.body;

  const parts = birthDate.split(".");
  if (parts.length !== 3) throw new AppError('Invalid date format. Expected DD.MM.YYYY', 400);

  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);

  if (isNaN(day) || isNaN(month)) throw new AppError('Invalid day or month in date', 400);

  const year = parts[2];
  const yearSum = year
    .split("")
    .reduce((acc: any, digit: any) => acc + parseInt(digit, 10), 0);

  const arcanRealization: number = toArcana(day)+month+splitNumberIntoDigits(yearSum)[0];
  const arcanMainBlock: number = toArcana(day)+splitNumberIntoDigits(month)[0];
  
  const moneyKnot: number = toArcana(arcanRealization+arcanMainBlock);
  const archetypePoverty: number = toArcana(toArcana(day)+month);
  const duty: number = toArcana(day+splitNumberIntoDigits(month)[0]+yearSum+8);
  const shadowWealth: number = toArcana(day+month+yearSum);

  const saleScriptContent = await Content.findOne({
    productType: 'forecast',
    productId: 'taroscope-main',
    isActive: true
  }).lean();

  const result = {
    financialCast: {
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
    },
    saleScript: saleScriptContent // Добавляем контент в ответ
  };

  res.status(200).json({
    status: "success",
    data: result,
  });
};

export const getFinancialCastAsPdf = async (req: Request, res: Response) => {
    const { birthDate } = req.body;

    const parts = birthDate.split('.');
    if (parts.length !== 3) throw new AppError('Invalid date format. Expected DD.MM.YYYY', 400);

    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);

    if (isNaN(day) || isNaN(month)) throw new AppError('Invalid day or month in date', 400);

    const year = parts[2];
    const yearSum = year
        .split("")
        .reduce((acc: any, digit: any) => acc + parseInt(digit, 10), 0);

    const arcanRealization: number = toArcana(day)+month+splitNumberIntoDigits(yearSum)[0];
    const arcanMainBlock: number = toArcana(day)+splitNumberIntoDigits(month)[0];
    
    const moneyKnot: number = toArcana(arcanRealization+arcanMainBlock);
    const archetypePoverty: number = toArcana(toArcana(day)+month);
    const duty: number = toArcana(day+splitNumberIntoDigits(month)[0]+yearSum+8);
    const shadowWealth: number = toArcana(day+month+yearSum);

    const financialCastData = {
      moneyKnot: {
        arcanum: moneyKnot,
        text: knotMap[moneyKnot] || "",
      },
      archetypePoverty: {
        arcanum: archetypePoverty,
        text: archetypePovertyMap[archetypePoverty] || "",
      },
      duty: {
        arcanum: duty,
        text: dutyMap[duty] || "",
      },
      shadowWealth: {
        arcanum: shadowWealth,
        text: shadowBMap[shadowWealth] || "",
      },
      rituals: Object.entries(ritualsMap).map(([title, text]) => ({
        title,
        text,
      }))
    };

    const saleScriptContent = await Content.findOne({
      productType: 'forecast',
      productId: 'taroscope-main',
      isActive: true
    }).lean();
    
    const filename = `financialCast_${birthDate.replace(/\./g, '-')}.pdf`;
    res.setHeader('Content-disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-type', 'application/pdf');

    const pdfData = {
      financialCast: financialCastData,
      saleScript: saleScriptContent,
    };

    generateFinancialCastPdf(pdfData, res, birthDate);
};