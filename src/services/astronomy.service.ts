import * as Astronomy from 'astronomy-engine';
import { CalculationResult, EphemerisConfig } from '../models/chart.model';
import { norm360 } from '../lib/angles';

type Body = Astronomy.Body;

const BODY_MAP: Record<string, Astronomy.Body> = {
  Sun: Astronomy.Body.Sun,
  Moon: Astronomy.Body.Moon,
  Mercury: Astronomy.Body.Mercury,
  Venus: Astronomy.Body.Venus,
  Earth: Astronomy.Body.Earth,
  Mars: Astronomy.Body.Mars,
  Jupiter: Astronomy.Body.Jupiter,
  Saturn: Astronomy.Body.Saturn,
  Uranus: Astronomy.Body.Uranus,
  Neptune: Astronomy.Body.Neptune,
  Pluto: Astronomy.Body.Pluto
};

export class AstronomyService {
  private isInitialized = false;
  // config оставлен для совместимости (не используется)
  constructor(private _config: EphemerisConfig) {}

  public async initialize(): Promise<void> {
    // astronomy-engine не требует инициализации, но сохраним контракт
    this.isInitialized = true;
  }

  /** Перевод Date -> AstroTime */
  private toTime(date: Date): Astronomy.AstroTime {
    return new Astronomy.AstroTime(date);
  }

  /** Геоцентрические эклиптические координаты (λ, β, r) */
  public async calculatePlanetPosition(
    jd: number,              // Юлианская дата (TT/UT — мы используем Date напрямую ниже)
    planetCode: number,      // не нужен, оставлен для совместимости
    name?: string            // имя планеты
  ): Promise<CalculationResult> {
    if (!this.isInitialized) throw new Error('Astronomy not initialized');
    if (!name) throw new Error('Planet name must be provided');

    const body = BODY_MAP[name];
    if (!body) throw new Error(`Unsupported body: ${name}`);

    // jd -> Date (UTC). astronomy-engine работает через Date/Time, а не JD.
    // Простой перевод: дни от J2000.0 = jd - 2451545.0
    // Но точнее — использовать epoch: у нас уже есть исходная дата снаружи,
    // поэтому вынесем конвертер в клиентский код. Здесь примем, что jd
    // получен из dateToJulian(date) ниже, поэтому можем восстановить Date.
    // Для надёжности дадим альтернативу: передавать сразу Date в API выше.
    const date = Astronomy.MakeTime(jd); // удобный конструктор из JD (TT)
    const time = date;

    // Гео-вектор планеты (экваториальные координаты, AU)
    const geo = Astronomy.GeoVector(body, time, true); // true -> коррект. светового времени
    const ecl = Astronomy.Ecliptic(geo);               // эклиптические λ, β в градусах
    const r = Math.sqrt(geo.x*geo.x + geo.y*geo.y + geo.z*geo.z); // расстояние в AU

    return {
      positions: [norm360(ecl.elon), ecl.elat, r, NaN] // скорость заполним на уровне процессора
    };
  }

  /** Юлианский день из обычной Date */
  public static dateToJulian(date: Date): number {
    // astronomy-engine даёт готовую функцию:
    const t = new Astronomy.AstroTime(date);
    return t.tt; // Юлианская дата (TT)
  }

  /** Date из JD (TT) */
  public static julianToDate(jd: number): Date {
    const t = Astronomy.MakeTime(jd);
    return t.date;
  }
}
