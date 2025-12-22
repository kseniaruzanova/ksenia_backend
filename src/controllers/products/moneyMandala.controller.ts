import { Request, Response } from "express";

import { toArcana, splitNumberIntoDigits } from "../../utils/arcan";
import { ArcanasData } from "../../types/arcan";
import { AppError } from "../../interfaces/appError";
import { MoneyMandalaCode, MoneyMandalaData } from "../../interfaces/arcan";
import { generateMoneyMandalaPdf } from "../../services/pdfGenerator.service";
import { trackProductRequest } from "../productStatistics.controller";
import { AuthRequest } from "../../interfaces/authRequest";

import oneData from "../../data/moneyMandala/code1.json";
import twoData from "../../data/moneyMandala/code2.json";
import threeData from "../../data/moneyMandala/code3.json";
import fourData from "../../data/moneyMandala/code4.json";
import fiveData from "../../data/moneyMandala/code5.json";
import sixData from "../../data/moneyMandala/code6.json";
import sevenData from "../../data/moneyMandala/code7.json";
import eightData from "../../data/moneyMandala/code8.json";
import nineData from "../../data/moneyMandala/code9.json";
import tenData from "../../data/moneyMandala/code10.json";
import elevenData from "../../data/moneyMandala/code11.json";
import twelveData from "../../data/moneyMandala/code12.json";
import thirteenData from "../../data/moneyMandala/code13.json";
import fourteenData from "../../data/moneyMandala/code14.json";
import fiveteenData from "../../data/moneyMandala/code15.json";
import sixteenData from "../../data/moneyMandala/code16.json";
import seventeenData from "../../data/moneyMandala/code17.json";
import eightteenData from "../../data/moneyMandala/code18.json";

const oneMap: ArcanasData = oneData;
const twoMap: ArcanasData = twoData;
const threeMap: ArcanasData = threeData;
const fourMap: ArcanasData = fourData;
const fiveMap: ArcanasData = fiveData;
const sixMap: ArcanasData = sixData;
const sevenMap: ArcanasData = sevenData;
const eightMap: ArcanasData = eightData;
const nineMap: ArcanasData = nineData;
const tenMap: ArcanasData = tenData;
const elevenMap: ArcanasData = elevenData;
const twelveMap: ArcanasData = twelveData;
const thirteenMap: ArcanasData = thirteenData;
const fourteenMap: ArcanasData = fourteenData;
const fiveteenMap: ArcanasData = fiveteenData;
const sixteenMap: ArcanasData = sixteenData;
const seventeenMap: ArcanasData = seventeenData;
const eightteenMap: ArcanasData = eightteenData;

export const getMoneyMandala = async (req: AuthRequest, res: Response) => {
  const { birthDate } = req.body;

  const moneyMandalaData: MoneyMandalaData = getMoneyMandalaData(birthDate);

  // Трекинг запроса
  if (req.user?.customerId) {
    await trackProductRequest('moneyMandala', req.user.customerId.toString(), birthDate, 'json');
  }

  res.status(200).json({
    status: "success",
    data: moneyMandalaData,
  });
};

export const getMoneyMandalaAsPdf = async (req: AuthRequest, res: Response) => {
  const { birthDate } = req.body;

  const moneyMandalaData: MoneyMandalaData = getMoneyMandalaData(birthDate);
    
  // Трекинг запроса
  if (req.user?.customerId) {
    await trackProductRequest('moneyMandala', req.user.customerId.toString(), birthDate, 'pdf');
  }

  const filename: string = `moneyMandala_${birthDate.replace(/\./g, '-')}.pdf`;
  res.setHeader('Content-disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-type', 'application/pdf');

  generateMoneyMandalaPdf(moneyMandalaData, res, birthDate);
};

function getMoneyMandalaData(birthDate: string): MoneyMandalaData {
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

  const numbers: MoneyMandalaCode[] = [];
  
  // Базовые вычисления
  const d9 = toArcana(day);
  const d10 = month;
  const d11 = toArcana(yearSum);

  const d14 = toArcana(day+month);
  const d15 = toArcana(d10+d11);
  const d16 = toArcana(d14+d15);

  const code1 = toArcana(d9 + 3);
  numbers.push({
    name: "Фундамент материального комфорта:",
    text: oneMap[code1] || "Трактовка не найдена"
  });

  const code2 = toArcana(d10 + 3);
  numbers.push({
    name: "Уроки на пути к материальному комфорту",
    text: twoMap[code2] || "Трактовка не найдена"
  });

  const code3 = toArcana(d11 + 3);
  numbers.push({
    name: "Источники материальных ресурсов:",
    text: threeMap[code3] || "Трактовка не найдена"
  });

  const code4 = toArcana(d14 + 3);
  numbers.push({
    name: "Причина нехватки денег:",
    text: fourMap[code4] || "Трактовка не найдена"
  });

  const code5 = toArcana(d15 + 3);
  numbers.push({
    name: "Точка слива энергии:",
    text: fiveMap[code5] || "Трактовка не найдена"
  });

  const code6 = toArcana(d16 + 3);
  numbers.push({
    name: "Зона масштаба материального комфорта:",
    text: sixMap[code6] || "Трактовка не найдена"
  });

  const code7 = toArcana(d9 + 10);
  numbers.push({
    name: "Незаменимые и необходимые ресурсы для заработка:",
    text: sevenMap[code7] || "Трактовка не найдена"
  });

  const code8 = toArcana(d10 + 10);
  numbers.push({
    name: "Ваши истинные потребности:",
    text: eightMap[code8] || "Трактовка не найдена"
  });

  const code9 = toArcana(d11 + 10);
  numbers.push({
    name: "Ваша точка материального роста:",
    text: nineMap[code9] || "Трактовка не найдена"
  });

  const code10 = toArcana(d14 + 10);
  numbers.push({
    name: "Эмоциональный триггер на пути к материальному росту:",
    text: tenMap[code10] || "Трактовка не найдена"
  });

  const code11 = toArcana(d15 + 10);
  numbers.push({
    name: "Ваши ресурсные установки:",
    text: elevenMap[code11] || "Трактовка не найдена"
  });

  const code12 = toArcana(d16 + 10);
  numbers.push({
    name: "Ваша энергия удачи:",
    text: twelveMap[code12] || "Трактовка не найдена"
  });

  const code13 = toArcana(d9 + 15);
  numbers.push({
    name: "Что вам дает энергию?",
    text: thirteenMap[code13] || "Трактовка не найдена"
  });

  const code14 = toArcana(d10 + 15);
  numbers.push({
    name: "Через что вы придете к осознанному удовольствию?",
    text: fourteenMap[code14] || "Трактовка не найдена"
  });

  const code15 = toArcana(d11 + 15);
  numbers.push({
    name: "Ваша подавленная энергия ресурса",
    text: fiveteenMap[code15] || "Трактовка не найдена"
  });

  const code16 = toArcana(d14 + 15);
  numbers.push({
    name: "Ваша заблокированная энергия легких денег в потоке",
    text: sixteenMap[code16] || "Трактовка не найдена"
  });

  const code17 = toArcana(d15 + 15);
  numbers.push({
    name: "Куда вам направлять энергию для реализации",
    text: seventeenMap[code17] || "Трактовка не найдена"
  });

  const code18 = toArcana(d16 + 15);
  numbers.push({
    name: "Ваш ресурс, который помогает получать удовольствие и поток в работе ",
    text: eightteenMap[code18] || "Трактовка не найдена"
  });

  return {
    numbers: numbers
  };
}
