import { Request, Response } from "express";

import { toArcana } from "../../utils/arcan";
import { AppError } from "../../interfaces/appError";
import { ArchetypeShadowData } from "../../interfaces/arcan";
import { generateArchetypeShadowPdf } from "../../services/pdfGenerator.service";
import { trackProductRequest } from "../productStatistics.controller";
import { AuthRequest } from "../../interfaces/authRequest";
import { ArcanasData } from "../../types/arcan";

import firstData from "../../data/archetypeShadow/first.json";
import secondData from "../../data/archetypeShadow/second.json";
import thirdData from "../../data/archetypeShadow/third.json";
import fourthData from "../../data/archetypeShadow/fourth.json";

const firstMap: ArcanasData = firstData;
const secondMap: ArcanasData = secondData;
const thirdMap: ArcanasData = thirdData;
const fourthMap: ArcanasData = fourthData;


export const getArchetypeShadowAsPdf = async (req: AuthRequest, res: Response) => {
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

  const first: number = toArcana(toArcana(day)+toArcana(month)+toArcana(yearSum));
  const second: number = toArcana((toArcana(day)+toArcana(month)+toArcana(yearSum))-day);
  const third: number = toArcana(first+toArcana(month));
  const fourth: number = toArcana(first+third);
  
  if (req.user?.customerId) {
    await trackProductRequest('archetypeShadow', req.user.customerId.toString(), birthDate, 'pdf');
  }

  const filename: string = `archetypeShadow_${birthDate.replace(/\./g, "-")}.pdf`;
  res.setHeader("Content-disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-type", "application/pdf");

  const archetypeShadowData: ArchetypeShadowData = {
    first: { arcanum: first, text: firstMap[first] },
    second: { arcanum: second, text: secondMap[second] },
    third: { arcanum: third, text: thirdMap[third] },
    fourth: { arcanum: fourth, text: fourthMap[fourth] }
  };

  generateArchetypeShadowPdf(archetypeShadowData, res, birthDate);
};
