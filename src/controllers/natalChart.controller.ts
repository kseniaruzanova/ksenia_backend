import { Request, Response } from 'express';

import { parseBirthDate } from '../utils/astro';
import { EphemerisConfig } from '../models/chart.model';
import { AstroProcessor } from '../services/astroProcessor.service';
import { degreesToSign, formatZodiacPosition } from '../lib/zodiac';

const config: EphemerisConfig = { ephemerisPath: '', flags: 0 };
const astro = new AstroProcessor(config, 'EQUAL');

async function ensureInit() {
  if (!(astro as any)._inited) {
    await astro.initialize();
    (astro as any)._inited = true;
  }
}

export const natalChartController = {
  async calculateNatalChart(req: Request, res: Response) {
    try {
      await ensureInit();

      const { date, latitude, longitude, timezone } = req.body;

      const birthDateUTC = parseBirthDate(date, timezone);


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
  }
};
