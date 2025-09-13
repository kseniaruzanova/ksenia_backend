import { AstronomyService } from './astronomy.service';
import {
  PlanetPosition,
  HouseCusp,
  ZodiacSign,
  Aspect,
  NatalChart,
  EphemerisConfig
} from '../models/chart.model';
import { absDelta, norm360 } from '../lib/angles';
import { degreesToSign } from '../lib/zodiac';
import * as Astronomy from 'astronomy-engine';

type HouseSystemCode = 'WHOLE' | 'EQUAL';

export class AstroProcessor {
  private astronomy: AstronomyService;
  private planetCodes!: Map<string, number>;
  private houseSystem: HouseSystemCode = 'WHOLE'; // по умолчанию Whole Sign

  constructor(config: EphemerisConfig, houseSystem: HouseSystemCode = 'WHOLE') {
    this.astronomy = new AstronomyService(config);
    this.houseSystem = houseSystem;
    this.initializePlanetCodes();
  }

  private initializePlanetCodes(): void {
    // код значения нам не нужны (astronomy-engine оперирует именами),
    // но сохраним карту имён для контракта
    this.planetCodes = new Map([
      ['Sun', 0],
      ['Moon', 1],
      ['Mercury', 2],
      ['Venus', 3],
      ['Mars', 4],
      ['Jupiter', 5],
      ['Saturn', 6],
      ['Uranus', 7],
      ['Neptune', 8],
      ['Pluto', 9],
      // Chiron/Nodes нет в astronomy-engine — требуют спец. эфемерид/приближений
    ]);
  }

  public async initialize(): Promise<void> {
    await this.astronomy.initialize();
  }

  // --- ВСПОМОГАТЕЛЬНОЕ ---

  private jdFromDate(date: Date): number {
    // Убедитесь, что работаете с UTC временем
    const utcDate = new Date(date.getTime() + date.getTimezoneOffset() * 60000);
    return AstronomyService.dateToJulian(utcDate);
  }

  private dateFromJd(jd: number): Date {
    return AstronomyService.julianToDate(jd);
  }

  /** Скорость по долготе: разность на dt суток */
  private async longitudeSpeedDegPerDay(date: Date, name: string, dtDays = 1/24): Promise<number> {
    const jd0 = this.jdFromDate(date);
    const jd1 = jd0 + dtDays;

    const p0 = await this.astronomy.calculatePlanetPosition(jd0, 0, name);
    const p1 = await this.astronomy.calculatePlanetPosition(jd1, 0, name);
    const lon0 = p0.positions[0];
    const lon1 = p1.positions[0];

    // кратчайшая разница
    const d = (lon1 - lon0 + 540) % 360 - 180;
    return d / dtDays;
  }

  private async planetPosition(date: Date, name: string): Promise<PlanetPosition> {
    const jd = this.jdFromDate(date);
    const r = await this.astronomy.calculatePlanetPosition(jd, 0, name);
    const [lon, lat, dist] = r.positions;
    const speed = await this.longitudeSpeedDegPerDay(date, name);
    const zodiacSign = degreesToSign(lon);
    
    return {
      name,
      longitude: norm360(lon),
      latitude: lat,
      distance: dist,
      speed,
      retrograde: speed < 0,
      zodiacSign
    };
  }

  // --- ДОМА (Whole Sign / Equal) ---

  /** Облиquity + Local Sidereal Time + MC для Equal/Whole */
  private computeMC(date: Date, longitude: number): number {
    // Получаем UTC дату
    const utcDate = new Date(date.getTime() + date.getTimezoneOffset() * 60000);
    
    // Вычисляем гринвичское звёздное время
    const gstHours = Astronomy.SiderealTime(utcDate);
    
    // Преобразуем в местное звёздное время
    const lstHours = gstHours + longitude / 15;
    const lst = ((lstHours % 24) + 24) % 24;
    
    return norm360(lst * 15);
  }

  private computeAscWholeEqual(date: Date, lat: number, lon: number): number {
    const mc = this.computeMC(date, lon);
    
    // Более точная формула для ASC
    const epsilon = 23.4393; // Наклон эклиптики
    const mcRad = mc * Math.PI / 180;
    const latRad = lat * Math.PI / 180;
    
    const ascRad = Math.atan2(
      Math.cos(mcRad),
      -Math.sin(mcRad) * Math.cos(epsilon) + Math.tan(latRad) * Math.sin(epsilon)
    );
    
    return norm360(ascRad * 180 / Math.PI);
  }

  private buildHousesWhole(asc: number): HouseCusp[] {
    const signStart = Math.floor(asc / 30) * 30;
    const houses: HouseCusp[] = [];
    for (let i = 0; i < 12; i++) {
      const position = norm360(signStart + i * 30);
      houses.push({ 
        house: i + 1, 
        position,
        zodiacSign: degreesToSign(position) // Добавляем знак зодиака
      });
    }
    return houses;
  }

  private buildHousesEqual(ascExact: number): HouseCusp[] {
    const houses: HouseCusp[] = [];
    for (let i = 0; i < 12; i++) {
      const position = norm360(ascExact + i * 30);
      houses.push({ 
        house: i + 1, 
        position,
        zodiacSign: degreesToSign(position) // Добавляем знак зодиака
      });
    }
    return houses;
  }

  // --- ПУБЛИЧНЫЕ МЕТОДЫ ---

  public async calculateNatalChart(
    birthDate: Date,
    lat: number,
    lon: number,
    timezone: number = 0
  ): Promise<NatalChart> {
    const utcDate = birthDate;

    const planetNames = Array.from(this.planetCodes.keys());

    // Планеты
    const planets: PlanetPosition[] = [];
    for (const name of planetNames) {
      const pos = await this.planetPosition(utcDate, name);
      planets.push(pos);
    }

    // Asc/MC (упрощённая модель для Whole/Equal)
    const mc = this.computeMC(utcDate, lon);
    const asc = this.computeAscWholeEqual(utcDate, lat, lon);

    // Дома
    const houses =
      this.houseSystem === 'WHOLE'
        ? this.buildHousesWhole(asc)
        : this.buildHousesEqual(asc);

    return {
      planets,
      houses,
      ascendant: asc,
      midheaven: mc,
      date: birthDate,
      location: { latitude: lat, longitude: lon, timezone }
    };
  }

  public async calculateTransits(
    _natalChart: NatalChart,
    currentDate: Date
  ): Promise<PlanetPosition[]> {
    const planetNames = Array.from(this.planetCodes.keys());
    const transits: PlanetPosition[] = [];
    for (const name of planetNames) {
      const pos = await this.planetPosition(currentDate, name);
      transits.push({ ...pos, name: `Transit ${name}` });
    }
    return transits;
  }

  public async calculateProgressions(
    natalChart: NatalChart,
    currentDate: Date
  ): Promise<PlanetPosition[]> {
    // secondary progressions: 1 day after birth = 1 year of life
    const birthJD = AstronomyService.dateToJulian(natalChart.date);
    const currentJD = AstronomyService.dateToJulian(currentDate);
    const daysDiff = currentJD - birthJD;
    const progressedJD = birthJD + daysDiff;

    const progressedDate = AstronomyService.julianToDate(progressedJD);

    const planetNames = Array.from(this.planetCodes.keys());
    const results: PlanetPosition[] = [];
    for (const name of planetNames) {
      const pos = await this.planetPosition(progressedDate, name);
      results.push({ ...pos, name: `Progressed ${name}` });
    }
    return results;
  }

  // --- АСПЕКТЫ ---

  private aspectType(angle: number): Aspect['type'] | null {
    const targets: { t: Aspect['type']; a: number; orb: number }[] = [
      { t: 'conjunction', a: 0,   orb: 8 },
      { t: 'sextile',     a: 60,  orb: 4 },
      { t: 'square',      a: 90,  orb: 6 },
      { t: 'trine',       a: 120, orb: 6 },
      { t: 'quincunx',    a: 150, orb: 3 },
      { t: 'opposition',  a: 180, orb: 8 },
    ];
    for (const x of targets) {
      const d = Math.min(
        Math.abs(angle - x.a),
        Math.abs(angle - (360 - x.a))
      );
      if (d <= x.orb) return x.t;
    }
    return null;
  }

  private aspectInfluence(t: Aspect['type']): Aspect['influence'] {
    switch (t) {
      case 'trine': case 'sextile': return 'positive';
      case 'square': case 'opposition': return 'negative';
      default: return 'neutral';
    }
  }

  public calculateAspects(planets: PlanetPosition[]): Aspect[] {
    const aspects: Aspect[] = [];
    for (let i = 0; i < planets.length; i++) {
      for (let j = i + 1; j < planets.length; j++) {
        const p1 = planets[i], p2 = planets[j];
        const angle = norm360(p2.longitude - p1.longitude);
        const type = this.aspectType(angle);
        if (!type) continue;

        const targetAngle = ({
          conjunction: 0,
          sextile: 60,
          square: 90,
          trine: 120,
          quincunx: 150,
          opposition: 180
        } as const)[type];

        const orb = Math.min(
          Math.abs(angle - targetAngle),
          Math.abs(360 - Math.abs(angle - targetAngle))
        );

        aspects.push({
          planet1: p1.name,
          planet2: p2.name,
          angle,
          type,
          orb,
          exact: orb < 0.5,
          influence: this.aspectInfluence(type),
        });
      }
    }
    return aspects;
  }

  public degreesToSign(longitude: number): ZodiacSign {
    return degreesToSign(longitude);
  }
}
