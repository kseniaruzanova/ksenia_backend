import { Router } from 'express';
import { EphemerisConfig } from '../models/chart.model';
import { AstroProcessor } from '../services/AstroProcessor';
import { degreesToSign, formatZodiacPosition } from '../lib/zodiac';

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

function parseBirthDate(dateStr: string, timezone: number): Date {
  // dateStr приходит в формате "YYYY-MM-DDTHH:mm"
  const [d, t] = dateStr.split("T");
  const [year, month, day] = d.split("-").map(Number);
  const [hour, minute] = t.split(":").map(Number);

  // создаём UTC-дата: вычитаем смещение часового пояса
  return new Date(Date.UTC(year, month - 1, day, hour - timezone, minute));
}

export default router; 
