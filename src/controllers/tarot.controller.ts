import { Request, Response } from "express";
import { AppError } from "../middleware/errorHandler";

// Загружаем колоды
import loveData from "../data/tarot/love.json";
import careerData from "../data/tarot/career.json";
import financeData from "../data/tarot/finance.json";

type TarotMap = { [key: string]: string };

const tarotMaps: Record<string, TarotMap> = {
  love: loveData as TarotMap,
  career: careerData as TarotMap,
  finance: financeData as TarotMap,
};

export const getTarotReading = async (req: Request, res: Response) => {
  const { cards } = req.body; // массив из 3 id

  if (!cards || !Array.isArray(cards) || cards.length !== 3) {
    throw new AppError("Нужно передать 3 карты (массив id)", 400);
  }

  // по одной карте из каждой колоды
  const [loveId, careerId, financeId] = cards;

  const love = tarotMaps.love[loveId];
  const career = tarotMaps.career[careerId];
  const finance = tarotMaps.finance[financeId];

  res.status(200).json({
    love,
    career,
    finance,
  });
};
