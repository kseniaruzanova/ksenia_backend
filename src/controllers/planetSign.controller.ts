import { Request, Response } from 'express';

import User from '../models/user.model';
import { degreesToSign } from '../lib/zodiac';
import { EphemerisConfig } from '../models/chart.model';
import { AstroProcessor } from '../services/astroProcessor.service';
import { convertDateFormat, parseBirthDate } from '../utils/astro';

const config: EphemerisConfig = { ephemerisPath: '', flags: 0 };
const astro = new AstroProcessor(config, 'EQUAL');

async function ensureInit() {
  if (!(astro as any)._inited) {
    await astro.initialize();
    (astro as any)._inited = true;
  }
}

export const planetSignController = {
  async getPlanetSign(req: Request, res: Response): Promise<void> {
    try {
      await ensureInit();
      console.log('Planet sign request:', req.body);
      
      const { chat_id, customerId, planet } = req.body;

      // Доступные планеты для запросов:
      // Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto
      // Солнце, Луна, Меркурий, Венера, Марс, Юпитер, Сатурн, Уран, Нептун, Плутон

      if (!chat_id || !customerId || !planet) {
        res.status(400).json({ 
          error: 'chat_id, customerId and planet are required' 
        });
        return;
      }

      const user = await User.findOne({
        chat_id: chat_id,
        customerId: customerId
      });
      if (!user) {
        res.status(404).json({ 
          error: 'User not found with provided chat_id and customerId' 
        });
        return;
      }

      if (!user.birthday || !user.birthTime || !user.latitude || !user.longitude) {
        res.status(400).json({ 
          error: 'User birth data is incomplete. Required: birthday, birthTime, latitude, longitude' 
        });
        return;
      }

      const convertedBirthday = user.birthday.includes('.') 
        ? convertDateFormat(user.birthday) 
        : user.birthday;
      
      const formattedBirthTime = user.birthTime && user.birthTime.includes(':') 
        ? user.birthTime 
        : '0:00';
      
      const dateStr = `${convertedBirthday}T${formattedBirthTime}`;
      const birthDateUTC = parseBirthDate(dateStr, user.timezone || 0);

      console.log("User birth data:", {
        originalBirthday: user.birthday,
        convertedBirthday: convertedBirthday,
        originalBirthTime: user.birthTime,
        formattedBirthTime: formattedBirthTime,
        latitude: user.latitude,
        longitude: user.longitude,
        timezone: user.timezone
      });
      console.log("Formed date string:", dateStr);
      console.log("Converted UTC:", birthDateUTC.toISOString());
      console.log("Planet:", planet);

      const chart = await astro.calculateNatalChart(
        birthDateUTC,
        user.latitude,
        user.longitude,
        user.timezone || 0
      );

      const planetData = chart.planets.find((p: any) => 
        p.name.toLowerCase() === planet.toLowerCase()
      );

      if (!planetData) {
        res.status(404).json({ 
          error: `Planet ${planet} not found` 
        });
        return;
      }

      const zodiacSign = degreesToSign(planetData.longitude);
      const signName = zodiacSign.sign;
      
      console.log("Zodiac calculation:", {
        longitude: planetData.longitude,
        zodiacSign: zodiacSign,
        signName: signName,
        signNameType: typeof signName
      });
      
      // Маппинг названий знаков на номера
      // 1 - Aries, 2 - Taurus, 3 - Gemini, 4 - Cancer
      // 5 - Leo, 6 - Virgo, 7 - Libra, 8 - Scorpio
      // 9 - Sagittarius, 10 - Capricorn, 11 - Aquarius, 12 - Pisces
      const signNumbers = {
        'Aries': 1,
        'Taurus': 2, 
        'Gemini': 3,
        'Cancer': 4,
        'Leo': 5,
        'Virgo': 6,
        'Libra': 7,
        'Scorpio': 8,
        'Sagittarius': 9,
        'Capricorn': 10,
        'Aquarius': 11,
        'Pisces': 12
      };

      const signNumber = signNumbers[signName as keyof typeof signNumbers] || 0;

      const russianSignNames = {
        1: 'Овен',
        2: 'Телец', 
        3: 'Близнецы',
        4: 'Рак',
        5: 'Лев',
        6: 'Дева',
        7: 'Весы',
        8: 'Скорпион',
        9: 'Стрелец',
        10: 'Козерог',
        11: 'Водолей',
        12: 'Рыбы'
      };

      const russianName = russianSignNames[signNumber as keyof typeof russianSignNames] || 'неизвестно';

      res.json({
        planet: planetData.name,
        longitude: planetData.longitude,
        zodiacSign: {
          number: signNumber,
          name: signName,
          russianName: russianName,
          degree: zodiacSign.degree,
          minute: zodiacSign.minute,
          second: zodiacSign.second,
          formattedPosition: `${zodiacSign.degree}°${zodiacSign.minute}'${zodiacSign.second}" ${signName}`,
          formattedPositionRussian: `${zodiacSign.degree}°${zodiacSign.minute}'${zodiacSign.second}" ${russianName}`
        },
        date: chart.date,
        location: chart.location,
        user: {
          id: user._id,
          chat_id: user.chat_id,
          customerId: user.customerId
        }
      });
    } catch (e: any) {
      console.error('Error in planet-sign route:', e);
      res.status(500).json({ error: e.message });
    }
  }
};
