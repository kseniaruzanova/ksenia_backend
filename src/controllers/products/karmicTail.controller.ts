import { Request, Response } from "express";

import { toArcana, normalizeToArcana } from "../../utils/arcan";
import { ArcanasData } from "../../types/arcan";
import { AppError } from "../../interfaces/appError";
import { KarmicTail, KarmicTailData } from "../../interfaces/arcan";
import { generateKarmicTailPdf } from "../../services/pdfGenerator.service";
import { trackProductRequest } from "../productStatistics.controller";
import { AuthRequest } from "../../interfaces/authRequest";

import karmicTailData from "../../data/karmicTail/karmicTail.json";
import financeCenterData from "../../data/karmicTail/financeCenter.json";
import purposeData from "../../data/karmicTail/purpose.json";
import lessonSoulData from "../../data/karmicTail/lessonSoul.json";
import karmaPastData from "../../data/karmicTail/karmaPast.json";

const karmicTailMap: ArcanasData = karmicTailData;
const financeCenterMap: ArcanasData = financeCenterData;
const purposeMap: ArcanasData = purposeData;
const lessonSoulMap: ArcanasData = lessonSoulData;
const karmaPastMap: ArcanasData = karmaPastData;

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

  const personalityPortrait: number = toArcana(day);
  const highestEssence: number = toArcana(month);
  const sumOfTheYear: number = toArcana(yearSum);
  
  const totalNumber: number = normalizeToArcana(personalityPortrait + highestEssence + sumOfTheYear);
  const center: number = normalizeToArcana(personalityPortrait + highestEssence + sumOfTheYear + totalNumber);
  
  const fatherTop: number = normalizeToArcana(personalityPortrait + highestEssence);
  const fatherLow: number = normalizeToArcana(sumOfTheYear + totalNumber);
  
  const motherTop: number = normalizeToArcana(highestEssence + sumOfTheYear);
  const motherLow: number = normalizeToArcana(personalityPortrait + totalNumber);

  const lineSky: number = normalizeToArcana(highestEssence + totalNumber);
  const lineEarth: number = normalizeToArcana(personalityPortrait + sumOfTheYear);
  const fatherLineage: number = normalizeToArcana(fatherTop + fatherLow);
  const motherLineage: number = normalizeToArcana(motherTop + motherLow);

  const personalPurpose: number = normalizeToArcana(lineSky + lineEarth);
  const socialPurpose: number = normalizeToArcana(fatherLineage + motherLineage);
  const spiritualPurpose: number = normalizeToArcana(personalPurpose + socialPurpose);
  const planetaryPurpose: number = normalizeToArcana(socialPurpose + spiritualPurpose);

  const karmicTail: string = `${normalizeToArcana(totalNumber + center)}-${normalizeToArcana(normalizeToArcana(totalNumber + center)+totalNumber)}-${totalNumber}`;
  
  const lessonSoul: number = totalNumber;

  const karmaPast: number = normalizeToArcana(sumOfTheYear+center);

  const financeCenter: number = normalizeToArcana(karmaPast+(normalizeToArcana(totalNumber + center)+karmaPast));

  const result: KarmicTail = {
    personalPurpose: purposeMap[personalPurpose] || "Трактовка не найдена",
    socialPurpose: purposeMap[socialPurpose] || "Трактовка не найдена",
    spiritualPurpose: purposeMap[spiritualPurpose] || "Трактовка не найдена",
    planetaryPurpose: purposeMap[planetaryPurpose] || "Трактовка не найдена",
    kamaciTail: karmicTailMap[karmicTail] || "Трактовка не найдена",
    lessonSoul: lessonSoulMap[lessonSoul] || "Трактовка не найдена",
    karmaPast: karmaPastMap[karmaPast] || "Трактовка не найдена",
    financeCenter: financeCenterMap[financeCenter] || "Трактовка не найдена"
  };

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

  const personalityPortrait: number = toArcana(day);
  const highestEssence: number = toArcana(month);
  const sumOfTheYear: number = toArcana(yearSum);
  
  const totalNumber: number = normalizeToArcana(personalityPortrait + highestEssence + sumOfTheYear);
  const center: number = normalizeToArcana(personalityPortrait + highestEssence + sumOfTheYear + totalNumber);
  
  const fatherTop: number = normalizeToArcana(personalityPortrait + highestEssence);
  const fatherLow: number = normalizeToArcana(sumOfTheYear + totalNumber);
  
  const motherTop: number = normalizeToArcana(highestEssence + sumOfTheYear);
  const motherLow: number = normalizeToArcana(personalityPortrait + totalNumber);

  const lineSky: number = normalizeToArcana(highestEssence + totalNumber);
  const lineEarth: number = normalizeToArcana(personalityPortrait + sumOfTheYear);
  const fatherLineage: number = normalizeToArcana(fatherTop + fatherLow);
  const motherLineage: number = normalizeToArcana(motherTop + motherLow);

  const personalPurpose: number = normalizeToArcana(lineSky + lineEarth);
  const socialPurpose: number = normalizeToArcana(fatherLineage + motherLineage);
  const spiritualPurpose: number = normalizeToArcana(personalPurpose + socialPurpose);
  const planetaryPurpose: number = normalizeToArcana(socialPurpose + spiritualPurpose);

  const karmicTail: string = `${normalizeToArcana(totalNumber + center)}-${normalizeToArcana(normalizeToArcana(totalNumber + center)+totalNumber)}-${totalNumber}`;
  
  const lessonSoul: number = totalNumber;

  const karmaPast: number = normalizeToArcana(sumOfTheYear+center);

  const financeCenter: number = normalizeToArcana(karmaPast+normalizeToArcana(normalizeToArcana(totalNumber + center)+karmaPast));

  const karmicTailData: KarmicTailData = {
    personalPurpose: { arcanum: personalPurpose, text: purposeMap[personalPurpose] || "Трактовка не найдена" },
    socialPurpose: { arcanum: socialPurpose, text: purposeMap[socialPurpose] || "Трактовка не найдена" },
    spiritualPurpose: { arcanum: spiritualPurpose, text: purposeMap[spiritualPurpose] || "Трактовка не найдена" },
    planetaryPurpose: { arcanum: planetaryPurpose, text: purposeMap[planetaryPurpose] || "Трактовка не найдена" },
    kamaciTail: { arcanum: karmicTail, text: karmicTailMap[karmicTail] || "Трактовка не найдена" },
    lessonSoul: { arcanum: lessonSoul, text: lessonSoulMap[lessonSoul] || "Трактовка не найдена" },
    karmaPast: { arcanum: karmaPast, text: karmaPastMap[karmaPast] || "Трактовка не найдена" },
    financeCenter: { arcanum: financeCenter, text: financeCenterMap[financeCenter] || "Трактовка не найдена" }
  };

  if (req.user?.customerId) {
    await trackProductRequest('karmicTail', req.user.customerId.toString(), birthDate, 'pdf');
  }
    
  const filename: string = `karmicTail_${birthDate.replace(/\./g, '-')}.pdf`;
  res.setHeader('Content-disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-type', 'application/pdf');

  generateKarmicTailPdf(karmicTailData, res, birthDate);
};
