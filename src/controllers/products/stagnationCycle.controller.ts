import { Response } from "express";

import { AppError } from "../../interfaces/appError";
import { AuthRequest } from "../../interfaces/authRequest";
import { ArcanasData } from "../../types/arcan";
import { StagnationCycleData } from "../../interfaces/arcan";
import { trackProductRequest } from "../productStatistics.controller";
import { generateStagnationCyclePdf } from "../../services/pdfGenerator.service";
import { normalizeToArcana, toArcana } from "../../utils/arcan";

import stagnationData from "../../data/stagnationCycle/stagnation.json";
import strikeData from "../../data/stagnationCycle/strike.json";
import cycleData from "../../data/stagnationCycle/cycle.json";
import exit1Data from "../../data/stagnationCycle/exit1.json";
import exit2Data from "../../data/stagnationCycle/exit2.json";
import exit3Data from "../../data/stagnationCycle/exit3.json";

const stagnationMap: ArcanasData = stagnationData;
const strikeMap: ArcanasData = strikeData;
const cycleMap: ArcanasData = cycleData;
const exit1Map: ArcanasData = exit1Data;
const exit2Map: ArcanasData = exit2Data;
const exit3Map: ArcanasData = exit3Data;

const monthNames: string[] = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
];

export const getStagnationCycleAsPdf = async (req: AuthRequest, res: Response) => {
  const { birthDate, chooseMonth } = req.body;

  if (!birthDate || typeof birthDate !== "string") {
    throw new AppError("birthDate is required", 400);
  }

  const parts: string[] = birthDate.split(".");
  if (parts.length !== 3) {
    throw new AppError("Invalid date format. Expected DD.MM.YYYY", 400);
  }

  const chooseMonthText: string = monthNames[Number(chooseMonth)-1];
  const day: number = parseInt(parts[0], 10);
  const month: number = parseInt(parts[1], 10);
  const year: string = parts[2];

  if (isNaN(day) || isNaN(month)) { 
    throw new AppError("Invalid day or month in date", 400); 
  }

  const yearSum: number = year
    .split("")
    .reduce((acc: any, digit: any) => acc + parseInt(digit, 10), 0);
  
  // Формула для ЗАСТОЙ
  const stagnation: number = toArcana(toArcana(day) + month + toArcana(yearSum) + Number(chooseMonth) + 12)

  // Формула для УДАР
  const strike: number = toArcana(toArcana(day) + Number(chooseMonth))

  // Формула для ЦИКЛ 
  const cycle: number = toArcana(strike + stagnation + toArcana(day + month + yearSum) + Number(chooseMonth))
  
  // Формула для Выход 1
  const exit1: number = toArcana(strike + stagnation + toArcana(day));
  
  // Формула для Выход 2
  const exit2: number = toArcana(strike + stagnation + 13);
  
  // Формула для Выход 3
  const exit3: number = toArcana(strike + stagnation + 21);

  if (req.user?.customerId) {
    await trackProductRequest("stagnationCycle", req.user.customerId.toString(), birthDate, "pdf");
  }

  const filename: string = `stagnationCycle_${birthDate.replace(/\./g, "-")}.pdf`;
  res.setHeader("Content-disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-type", "application/pdf");

  const data: StagnationCycleData = {
    stagnation: {
      arcanum: stagnation,
      text: stagnationMap[stagnation] || "Трактовка не найдена",
    },
    cycle: {
      arcanum: cycle,
      text: cycleMap[cycle] || "Трактовка не найдена",
    },
    strike: {
      arcanum: strike,
      text: strikeMap[strike] || "Трактовка не найдена",
    },
    exit1: {
      arcanum: exit1,
      text: exit1Map[exit1] || "Трактовка не найдена",
    },
    exit2: {
      arcanum: exit2,
      text: exit2Map[exit2] || "Трактовка не найдена",
    },
    exit3: {
      arcanum: exit3,
      text: exit3Map[exit3] || "Трактовка не найдена",
    },
  };

  generateStagnationCyclePdf(data, res, birthDate, chooseMonthText);
};

