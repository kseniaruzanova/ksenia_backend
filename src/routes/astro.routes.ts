import { Router, Request, Response } from 'express';
import { EphemerisConfig } from '../models/chart.model';
import { AstroProcessor } from '../services/AstroProcessor';
import { degreesToSign, formatZodiacPosition } from '../lib/zodiac';
import User from '../models/user.model';

const router = Router();

const config: EphemerisConfig = { ephemerisPath: '', flags: 0 };
const astro = new AstroProcessor(config, 'EQUAL');

async function ensureInit() {
  if (!(astro as any)._inited) {
    await astro.initialize();
    (astro as any)._inited = true;
  }
}

router.post('/natal', async (req, res) => {
  try {
    await ensureInit();
    console.log(req.body)
    const { date, latitude, longitude, timezone } = req.body;

    const birthDateUTC = parseBirthDate(date, timezone);

    console.log("Input date (local):", date);
    console.log("Converted UTC:", birthDateUTC.toISOString());

    const chart = await astro.calculateNatalChart(
      birthDateUTC,
      latitude,
      longitude,
      timezone ?? 0
    );

    const aspects = astro.calculateAspects(chart.planets);

    res.json({
      planets: chart.planets.map((p: any) => ({
        name: p.name,
        longitude: p.longitude,
        latitude: p.latitude,
        distance: p.distance,
        speed: p.speed,
        retrograde: p.retrograde,
        zodiacSign: p.zodiacSign,
        formattedPosition: `${p.zodiacSign.degree}°${p.zodiacSign.minute}'${p.zodiacSign.second}" ${p.zodiacSign.sign}`
      })),
      houses: chart.houses.map((h: any) => ({
        house: h.house,
        position: h.position,
        zodiacSign: h.zodiacSign,
        formattedPosition: `${h.zodiacSign.degree}°${h.zodiacSign.minute}'${h.zodiacSign.second}" ${h.zodiacSign.sign}`
      })),
      ascendant: {
        longitude: chart.ascendant,
        zodiacSign: degreesToSign(chart.ascendant),
        formattedPosition: formatZodiacPosition(degreesToSign(chart.ascendant))
      },
      midheaven: {
        longitude: chart.midheaven,
        zodiacSign: degreesToSign(chart.midheaven),
        formattedPosition: formatZodiacPosition(degreesToSign(chart.midheaven))
      },
      aspects,
      date: chart.date,
      location: chart.location
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/planet-sign', async (req: Request, res: Response): Promise<void> => {
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

    // Получаем данные пользователя из базы данных по chat_id и customerId
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

    // Проверяем наличие необходимых данных
    if (!user.birthday || !user.birthTime || !user.latitude || !user.longitude) {
      res.status(400).json({ 
        error: 'User birth data is incomplete. Required: birthday, birthTime, latitude, longitude' 
      });
      return;
    }

    // Формируем дату рождения из данных пользователя
    // Преобразуем дату из формата ММ.ДД.ГГ в ГГ-ММ-ДД если необходимо
    const convertedBirthday = user.birthday.includes('.') 
      ? convertDateFormat(user.birthday) 
      : user.birthday;
    const dateStr = `${convertedBirthday}T${user.birthTime}`;
    const birthDateUTC = parseBirthDate(dateStr, user.timezone || 0);

    console.log("User birth data:", {
      originalBirthday: user.birthday,
      convertedBirthday: convertedBirthday,
      birthTime: user.birthTime,
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

    // Находим нужную планету
    const planetData = chart.planets.find((p: any) => 
      p.name.toLowerCase() === planet.toLowerCase()
    );

    if (!planetData) {
      res.status(404).json({ 
        error: `Planet ${planet} not found` 
      });
      return;
    }

    // Получаем знак зодиака
    const zodiacSign = degreesToSign(planetData.longitude);
    const signNumber = parseInt(zodiacSign.sign.toString());
    
    console.log("Zodiac calculation:", {
      longitude: planetData.longitude,
      zodiacSign: zodiacSign,
      signNumber: signNumber,
      signNumberType: typeof signNumber
    });
    
    // Маппинг номеров знаков на названия (английские)
    // 1 - Aries, 2 - Taurus, 3 - Gemini, 4 - Cancer
    // 5 - Leo, 6 - Virgo, 7 - Libra, 8 - Scorpio
    // 9 - Sagittarius, 10 - Capricorn, 11 - Aquarius, 12 - Pisces
    const signNames = {
      1: 'Aries',
      2: 'Taurus', 
      3: 'Gemini',
      4: 'Cancer',
      5: 'Leo',
      6: 'Virgo',
      7: 'Libra',
      8: 'Scorpio',
      9: 'Sagittarius',
      10: 'Capricorn',
      11: 'Aquarius',
      12: 'Pisces'
    };

    const signName = signNames[signNumber as unknown as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12] || 'Unknown';

    res.json({
      planet: planetData.name,
      longitude: planetData.longitude,
      zodiacSign: {
        number: signNumber,
        name: signName,
        degree: zodiacSign.degree,
        minute: zodiacSign.minute,
        second: zodiacSign.second,
        formattedPosition: `${zodiacSign.degree}°${zodiacSign.minute}'${zodiacSign.second}" ${signName}`
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
});

function parseBirthDate(dateStr: string, timezone: number): Date {
  // dateStr приходит в формате "YYYY-MM-DDTHH:mm"
  const [d, t] = dateStr.split("T");
  const [year, month, day] = d.split("-").map(Number);
  const [hour, minute] = t.split(":").map(Number);

  // создаём UTC-дата: вычитаем смещение часового пояса
  return new Date(Date.UTC(year, month - 1, day, hour - timezone, minute));
}

function convertDateFormat(dateStr: string): string {
  // Преобразует дату из формата ММ.ДД.ГГ в ГГ-ММ-ДД
  // Пример: "09.09.2006" -> "2006-09-09"
  const [month, day, year] = dateStr.split(".");
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

export default router; 
