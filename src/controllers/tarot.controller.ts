import { Request, Response } from "express";

import { AppError } from "../interfaces/appError";
import { TarotMap, TarotMaps } from "../interfaces/tarot";

import loveData from "../data/tarot/love.json";
import careerData from "../data/tarot/career.json";
import financeData from "../data/tarot/finance.json";

const tarotMaps: TarotMaps = {
  love: loveData as TarotMap,
  career: careerData as TarotMap,
  finance: financeData as TarotMap,
};

export const getTarotReading = async (req: Request, res: Response) => {
  const { cards } = req.body;

  if (!cards || !Array.isArray(cards) || cards.length !== 3) {
    throw new AppError("Нужно передать 3 карты (массив id)", 400);
  }

  const [loveId, careerId, financeId] = cards as string[];

  const love: string = tarotMaps.love[loveId];
  const career: string = tarotMaps.career[careerId];
  const finance: string = tarotMaps.finance[financeId];

  res.status(200).json({
    love,
    career,
    finance,
  });
};
