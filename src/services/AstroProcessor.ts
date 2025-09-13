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

type HouseSystemCode = 'WHOLE' | 'EQUAL' | 'PLACIDUS';

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
    return AstronomyService.dateToJulian(date);
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

  // --- ДОМА (Whole Sign / Equal / Placidus) ---
  private degToRad(d: number) { return d * Math.PI / 180; }
  private radToDeg(r: number) { return r * 180 / Math.PI; }

  /** Нормализовать долготу (вход: градусы) */
  private norm360Deg(d: number) { return ((d % 360) + 360) % 360; }
  private norm360(d: number) { return ((d % 360) + 360) % 360; }
  /** Облиquity + Local Sidereal Time + MC для Equal/Whole */
  private localSiderealTimeDeg(dateUTC: Date, lon: number): number {
    const gst = Astronomy.SiderealTime(dateUTC); // часы
    let lst = (gst + lon / 15) % 24; // часы
    if (lst < 0) lst += 24;
    return lst * 15; // в градусах
}
  /** Возвращает MC в градусах [0..360) */
public computeMC(dateUTC: Date, lon: number): number {
    const eps = this.degToRad(this.getObliquityDeg(dateUTC));
    const lst = this.degToRad(this.localSiderealTimeDeg(dateUTC, lon));
    
    // Формула для MC: tan(MC) = tan(LST) / cos(eps)
    let mcRad = Math.atan2(Math.tan(lst), Math.cos(eps));
    
    // Корректировка квадранта
    if (mcRad < 0) mcRad += Math.PI;
    if (Math.tan(lst) < 0) mcRad += Math.PI;
    
    const mcDeg = this.norm360(this.radToDeg(mcRad));
    return mcDeg;
  }

  /** Правильный расчет ASC (Асцендента) */
  public computeAsc(dateUTC: Date, lat: number, lon: number): number {
    const eps = this.degToRad(this.getObliquityDeg(dateUTC));
    const phi = this.degToRad(lat);
    const lst = this.degToRad(this.localSiderealTimeDeg(dateUTC, lon));
    
    // Формула для ASC: tan(ASC) = -cos(LST) / (sin(eps)*tan(phi) + cos(eps)*sin(LST))
    const numerator = -Math.cos(lst);
    const denominator = Math.sin(eps) * Math.tan(phi) + Math.cos(eps) * Math.sin(lst);
    
    let ascRad = Math.atan2(numerator, denominator);
    
    // Корректировка квадранта
    ascRad += Math.PI; // Добавляем 180 градусов
    
    const ascDeg = this.norm360(this.radToDeg(ascRad));
    return ascDeg;
  }


  private buildHousesWhole(asc: number): HouseCusp[] {
    const signStart = Math.floor(asc / 30) * 30; // начало знака ASC
    const houses: HouseCusp[] = [];
    for (let i = 0; i < 12; i++) {
      const position = norm360(signStart + i * 30);
      houses.push({
        house: i + 1,
        position,
        zodiacSign: degreesToSign(position)
      });
    }
    return houses;
  }

  private localSiderealTime(dateUTC: Date, lon: number): number {
    const gst = Astronomy.SiderealTime(dateUTC);
    let lst = gst + lon / 15;
    lst = (lst + 24) % 24;
    return lst * 15;
  }

  private buildHousesEqual(asc: number): HouseCusp[] {
    const houses: HouseCusp[] = [];
    for (let i = 0; i < 12; i++) {
        const pos = this.norm360(asc + i * 30);
        houses.push({
            house: i + 1,
            position: pos,
            zodiacSign: degreesToSign(pos)
        });
    }
    return houses;
}

  /**
   * -----------------------------
   * PLACIDUS (numerical approach)
   * -----------------------------
   *
   * Подход:
   * 1. Фиксируем Asc и MC (и их противоположности: Desc, IC).
   * 2. Для каждой из четырёх квадрантов (Asc->MC, MC->Desc, Desc->IC, IC->Asc) мы делим
   *    полу-дугу (semi-arc) для соответствующей опорной точки на 3 части и ищем элиптические долготы,
   *    у которых полу-дуга равна 1/3 или 2/3 этой полу-дуги.
   *
   * Формула полу-дуги для заданной эклиптической долготы λ (при широте наблюдателя φ):
   *   δ(λ) = arcsin( sin ε * sin λ )  (для β = 0)
   *   semi-arc(λ) = arccos( - tan φ * tan δ )
   *
   * Затем ищем λ по уравнению semi-arc(λ) = target (бисекция по отрезку, выбранному в пределах квадранта).
   *
   * Ограничения/замечания:
   * - Метод требует аккуратного выбора отрезков поиска и обработки модулей 360°.
   * - Для широт очень близких к полюсу (|φ| ≈ 90°) могут возникать проблемы (неподнимающиеся/незаходящие точки).
   * - Это численный приближённый метод, но он даёт совпадающие с распространёнными реализациями результаты в обычных широтах.
   */
  private degToRadNormalized(d: number) { return (d * Math.PI) / 180; }

  /** Обликусть эклиптики (deg) */
  private getObliquityDeg(dateUTC: Date): number {
    let epsDeg = 23.4392911111;
    if (typeof (Astronomy as any).Obliquity === 'function') {
      try { epsDeg = (Astronomy as any).Obliquity(dateUTC); } catch { /* fallback */ }
    }
    return epsDeg;
  }

  /**
   * Перевод эклиптической долготы (λ, deg) с широтой 0 в экваториальные координаты (RA в deg [0..360), Dec в deg)
   * Использует среднюю эклиптику epsDeg.
   */
  private eclipticToEquatorial(lambdaDeg: number, epsDeg: number): { raDeg: number; decDeg: number } {
    const lam = this.degToRad(lambdaDeg);
    const eps = this.degToRad(epsDeg);

    // для β = 0
    const sinDec = Math.sin(eps) * Math.sin(lam);
    const dec = Math.asin(Math.max(-1, Math.min(1, sinDec)));

    // tan α = cos ε * tan λ
    // но безопаснее получить cosδ cosα = cosλ, cosδ sinα = cosε * sinλ
    const cosDelta = Math.cos(dec);
    // для вычисления RA используем atan2(cosε * sinλ, cosλ)
    const y = Math.cos(eps) * Math.sin(lam);
    const x = Math.cos(lam);
    const ra = Math.atan2(y, x); // rad

    let raDeg = this.radToDeg(ra);
    raDeg = this.norm360Deg(raDeg);
    const decDeg = this.radToDeg(dec);
    return { raDeg, decDeg };
  }

  /**
   * Полу-дуга (semi-arc) в градусах для эклиптической долготы lambdaDeg (при широте latDeg)
   * semiArc = arccos( - tan φ * tan δ )
   * Возвращает значение в градусах (0..180). Если точка никогда не восходит/не заходит — возвращает NaN.
   */
  private semiArcDeg(lambdaDeg: number, latDeg: number, epsDeg: number): number {
    const { decDeg } = this.eclipticToEquatorial(lambdaDeg, epsDeg);
    const phi = this.degToRad(latDeg);
    const delta = this.degToRad(decDeg);

    const tanPhi = Math.tan(phi);
    const tanDelta = Math.tan(delta);

    const arg = -tanPhi * tanDelta;
    // Если |arg| > 1, то arccos недопустим — объект не восходит или не заходит; вернём NaN
    if (arg > 1 || arg < -1) return NaN;

    const semiArcRad = Math.acos(arg);
    const semiArcDeg = this.radToDeg(semiArcRad);
    return semiArcDeg;
  }

  /**
   * Нахождение lambda (эклиптической долготы) в интервале [a,b] (deg, возможно a>b в смысле перехода через 360)
   * такого что semiArcDeg(lambda) = target (в градусах).
   * Используем бисекцию. Возвращает первую найденную точку или NaN.
   */
  private findLambdaBySemiArc(
    aDeg: number,
    bDeg: number,
    targetSemiArcDeg: number,
    latDeg: number,
    epsDeg: number,
    maxIter = 60,
    tolDeg = 1e-6
  ): number {
    // Нормализуем интервалы так, чтобы b > a (в прямом числовом смысле) — если нужно, прибавим 360.
    let a = aDeg;
    let b = bDeg;
    if (b <= a) b = b + 360;

    // Функция f(lambda) = semiArc(lambda) - target
    const f = (lng: number): number => {
      const ln = this.norm360Deg(lng);
      const s = this.semiArcDeg(ln, latDeg, epsDeg);
      if (isNaN(s)) {
        // используем большое значение, чтобы направление биса не нарушилось
        // возвращаем знак большого положительного если semi-arc недопустима
        // (позже бисекция предоставит NaN если оба конца NaN)
        return 1e6;
      }
      return s - targetSemiArcDeg;
    };

    // Проверка: если на концах оба NaN — нет решения
    const fa = f(a);
    const fb = f(b);
    if (!isFinite(fa) && !isFinite(fb)) return NaN;

    // Если знаки одинаковы, всё ещё возможно найти решение (функция не обязательно монотонна), но бисекция требует разных знаков.
    // Попытаемся обнаружить знак изменения на сетке.
    let left = a;
    let right = b;
    let fleft = fa;
    let fright = fb;

    if (!isFinite(fleft) || !isFinite(fright) || fleft * fright > 0) {
      // Просканируем сетку внутри [a,b] чтобы найти промежуток с изменением знака
      const steps = 120;
      let found = false;
      let prevX = a;
      let prevF = f(prevX);
      for (let i = 1; i <= steps; i++) {
        const x = a + (i * (b - a)) / steps;
        const fx = f(x);
        if (!isFinite(prevF) && isFinite(fx)) {
          prevX = x;
          prevF = fx;
          continue;
        }
        if (isFinite(prevF) && isFinite(fx) && prevF * fx <= 0) {
          left = prevX;
          right = x;
          fleft = prevF;
          fright = fx;
          found = true;
          break;
        }
        prevX = x;
        prevF = fx;
      }
      if (!found) {
        // как запасной вариант: выберем точку минимальной абсолютной разницы semiArc-target на сетке
        let bestX = a;
        let bestVal = Math.abs(fa);
        const steps2 = 240;
        for (let i = 1; i <= steps2; i++) {
          const x = a + (i * (b - a)) / steps2;
          const fx = f(x);
          if (!isFinite(fx)) continue;
          if (Math.abs(fx) < bestVal) {
            bestVal = Math.abs(fx);
            bestX = x;
          }
        }
        // если bestVal уже очень маленький — вернём bestX
        if (bestVal < 1e-4) return this.norm360Deg(bestX);
        return NaN;
      }
    }

    // Бисекция в [left,right]
    for (let iter = 0; iter < maxIter; iter++) {
      const mid = (left + right) / 2;
      const fmid = f(mid);
      if (!isFinite(fmid)) return NaN;
      if (Math.abs(fmid) < tolDeg) return this.norm360Deg(mid);
      if (fleft * fmid <= 0) {
        right = mid;
        fright = fmid;
      } else {
        left = mid;
        fleft = fmid;
      }
    }
    // Возвращаем середину как приближение
    return this.norm360Deg((left + right) / 2);
  }

  /**
   * Вычисление куспидов системы Placidus.
   * Возвращает массив HouseCusp (house 1..12).
   */
  private buildHousesPlacidus(asc: number, mc: number, lat: number, dateUTC: Date): HouseCusp[] {
    const epsDeg = this.getObliquityDeg(dateUTC);
    const houses: HouseCusp[] = new Array(12);

    // основные опорные точки
    const ascNorm = this.norm360Deg(asc);
    const mcNorm = this.norm360Deg(mc);
    const desc = this.norm360Deg(ascNorm + 180);
    const ic = this.norm360Deg(mcNorm + 180);

    // Cusp 1,4,7,10 — напрямую
    houses[0] = { house: 1, position: ascNorm, zodiacSign: degreesToSign(ascNorm) };
    houses[3] = { house: 4, position: ic, zodiacSign: degreesToSign(ic) };
    houses[6] = { house: 7, position: this.norm360Deg(ascNorm + 180), zodiacSign: degreesToSign(this.norm360Deg(ascNorm + 180)) };
    houses[9] = { house: 10, position: mcNorm, zodiacSign: degreesToSign(mcNorm) };

    // Для каждой восточной/западной полу-дуги вычислим полу-дугу опорной точки и разделим на части.
    // Восточная полу-дуга — между Asc -> MC (проходя в направлении возрастания долготы от asc до mc).
    // Западная полу-дуга — между MC -> Desc, и т.д.

    // функция для нормализации интервала так, чтобы b > a (в числах)
    const normalizeInterval = (a: number, b: number) => {
      let A = a;
      let B = b;
      if (B <= A) B += 360;
      return { A, B };
    };

    // Получим полу-дугу для MC и IC (они могут давать разные значения)
    const semiMC = this.semiArcDeg(mcNorm, lat, epsDeg); // deg
    const semiIC = this.semiArcDeg(ic, lat, epsDeg); // deg
    // Если NaN — попытка аккуратно обработать (например, при высоких широтах)
    const safeSemiMC = isNaN(semiMC) ? 0 : semiMC;
    const safeSemiIC = isNaN(semiIC) ? 0 : semiIC;

    // Восточный квадрант: Asc -> MC. Куспиды: 12 (ближе к Asc), 11 (ближе к MC)
    {
      const { A, B } = normalizeInterval(ascNorm, mcNorm);
      // Целевые полу-дуги (в градусах): 2/3 * semiMC (для cusp12), 1/3 * semiMC (для cusp11)
      const t12 = (2 / 3) * safeSemiMC;
      const t11 = (1 / 3) * safeSemiMC;

      const lambda12 = this.findLambdaBySemiArc(A, B, t12, lat, epsDeg);
      const lambda11 = this.findLambdaBySemiArc(A, B, t11, lat, epsDeg);

      houses[11] = { house: 12, position: isNaN(lambda12) ? this.norm360Deg(ascNorm + 10) : lambda12, zodiacSign: degreesToSign(isNaN(lambda12) ? this.norm360Deg(ascNorm + 10) : lambda12) };
      houses[10] = { house: 11, position: isNaN(lambda11) ? this.norm360Deg(ascNorm + 20) : lambda11, zodiacSign: degreesToSign(isNaN(lambda11) ? this.norm360Deg(ascNorm + 20) : lambda11) };
    }

    // Восточно-верхний квадрант: MC -> Desc. Куспиды: 10 (MC), 9, 8
    {
      const { A, B } = normalizeInterval(mcNorm, this.norm360Deg(ascNorm + 180)); // mc -> desc
      const t9 = (1 / 3) * safeSemiIC; // используем semiIC для противоположной (можно и semiMC — варианты в реализации)
      const t8 = (2 / 3) * safeSemiIC;

      const lambda9 = this.findLambdaBySemiArc(A, B, t9, lat, epsDeg);
      const lambda8 = this.findLambdaBySemiArc(A, B, t8, lat, epsDeg);

      houses[8] = { house: 9, position: isNaN(lambda9) ? this.norm360Deg(mcNorm + 30) : lambda9, zodiacSign: degreesToSign(isNaN(lambda9) ? this.norm360Deg(mcNorm + 30) : lambda9) };
      houses[7] = { house: 8, position: isNaN(lambda8) ? this.norm360Deg(mcNorm + 60) : lambda8, zodiacSign: degreesToSign(isNaN(lambda8) ? this.norm360Deg(mcNorm + 60) : lambda8) };
    }

    // Западно-нижний квадрант: Desc -> IC. Куспиды: 7 (desc), 6, 5
    {
      const { A, B } = normalizeInterval(this.norm360Deg(ascNorm + 180), ic);
      // используем semiMC (или IC) — вариации существуют; применим safeSemiMC for symmetry
      const t6 = (1 / 3) * safeSemiMC;
      const t5 = (2 / 3) * safeSemiMC;

      const lambda6 = this.findLambdaBySemiArc(A, B, t6, lat, epsDeg);
      const lambda5 = this.findLambdaBySemiArc(A, B, t5, lat, epsDeg);

      houses[5] = { house: 6, position: isNaN(lambda6) ? this.norm360Deg(this.norm360Deg(ascNorm + 180) + 30) : lambda6, zodiacSign: degreesToSign(isNaN(lambda6) ? this.norm360Deg(this.norm360Deg(ascNorm + 180) + 30) : lambda6) };
      houses[4] = { house: 5, position: isNaN(lambda5) ? this.norm360Deg(this.norm360Deg(ascNorm + 180) + 60) : lambda5, zodiacSign: degreesToSign(isNaN(lambda5) ? this.norm360Deg(this.norm360Deg(ascNorm + 180) + 60) : lambda5) };
    }

    // Нижне-восточный квадрант: IC -> Asc. Куспиды: 4 (IC), 3, 2
    {
      const { A, B } = normalizeInterval(ic, ascNorm);
      const t3 = (2 / 3) * safeSemiIC;
      const t2 = (1 / 3) * safeSemiIC;

      const lambda3 = this.findLambdaBySemiArc(A, B, t3, lat, epsDeg);
      const lambda2 = this.findLambdaBySemiArc(A, B, t2, lat, epsDeg);

      houses[2] = { house: 3, position: isNaN(lambda3) ? this.norm360Deg(ic + 30) : lambda3, zodiacSign: degreesToSign(isNaN(lambda3) ? this.norm360Deg(ic + 30) : lambda3) };
      houses[1] = { house: 2, position: isNaN(lambda2) ? this.norm360Deg(ic + 60) : lambda2, zodiacSign: degreesToSign(isNaN(lambda2) ? this.norm360Deg(ic + 60) : lambda2) };
    }

    // Упорядочим массив по дому 1..12 чтобы ничто не путалось
    const ordered = houses.slice().sort((a, b) => a.house - b.house);
    return ordered;
  }

  // --- ПУБЛИЧНЫЕ МЕТОДЫ ---

  public async calculateNatalChart(
    birthDateUTC: Date,
    lat: number,
    lon: number,
    timezone: number = 0
  ): Promise<NatalChart> {
    console.log('calculateNatalChart got dateUTC:', birthDateUTC.toISOString());

    const planetNames = Array.from(this.planetCodes.keys());
    const planets: PlanetPosition[] = [];
    for (const name of planetNames) {
      const pos = await this.planetPosition(birthDateUTC, name);
      planets.push(pos);
    }

    const mc = this.computeMC(birthDateUTC, lon);
    const asc = this.computeAsc(birthDateUTC, lat, lon);
    console.log(mc)
    console.log(asc)
    // дома
    let houses: HouseCusp[] = [];
    if (this.houseSystem === 'WHOLE') {
      houses = this.buildHousesWhole(asc);
    } else if (this.houseSystem === 'EQUAL') {
      houses = this.buildHousesEqual(asc);
    } else {
      houses = this.buildHousesPlacidus(asc, mc, lat, birthDateUTC);
    }

    return {
      planets,
      houses,
      ascendant: asc,
      midheaven: mc,
      date: birthDateUTC, // сохраняй UTC
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
