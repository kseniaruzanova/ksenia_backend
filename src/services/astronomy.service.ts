import * as Astronomy from 'astronomy-engine';
import { CalculationResult, EphemerisConfig } from '../models/chart.model';
import { norm360 } from '../utils/angles';

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

  constructor(private _config: EphemerisConfig) {}

  public async initialize(): Promise<void> {
    this.isInitialized = true;
  }

  public async calculatePlanetPosition(
    jd: number,
    planetCode: number,
    name?: string
  ): Promise<CalculationResult> {
    if (!this.isInitialized) throw new Error('Astronomy not initialized');
    if (!name) throw new Error('Planet name must be provided');

    const body = BODY_MAP[name];
    if (!body) throw new Error(`Unsupported body: ${name}`);

    const date = Astronomy.MakeTime(jd);
    const time = date;

    const geo = Astronomy.GeoVector(body, time, true);
    const ecl = Astronomy.Ecliptic(geo);
    const r = Math.sqrt(geo.x*geo.x + geo.y*geo.y + geo.z*geo.z);

    return {
      positions: [norm360(ecl.elon), ecl.elat, r, NaN]
    };
  }

  public static dateToJulian(date: Date): number {
    const t = new Astronomy.AstroTime(date);
    return t.tt;
  }

  public static julianToDate(jd: number): Date {
    const t = Astronomy.MakeTime(jd);
    return t.date;
  }
}
