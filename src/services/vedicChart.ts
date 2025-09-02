// file: vedicChart.ts
// npm i node-fetch (если Node < 18) — иначе global fetch уже есть
// Этот модуль не завязан на конкретный API: достаточно реализовать интерфейс Provider.

///////////////////////
// Типы и константы //
///////////////////////

export type PlanetKey =
  | "Sun" | "Moon" | "Mars" | "Mercury" | "Jupiter" | "Venus" | "Saturn"
  | "Rahu" | "Ketu" | "Asc";

export interface BirthInput {
  date: string;     // "1985-06-09" (UTC дата рождения)
  time: string;     // "14:45" (локальное время рождения)
  tz: number;       // часовой пояс в ЧАСАХ, напр. +3 => 3, -5 => -5
  lat: number;      // широта
  lon: number;      // долгота
  nodeType?: "true" | "mean"; // какой Раху нужен (по умолч. "true")
}

export interface PlanetRaw {
  key: PlanetKey;         // идентификатор планеты
  lon: number;            // сидерическая долгота, [0..360)
}

export interface CoreApiResponse {
  // Сидерические долготы (Лахири) всех нужных тел в D1.
  planets: PlanetRaw[];   // Sun..Saturn, Rahu (Ketu рассчитаем), Asc (Lagna)
  ayanamsha?: number;     // (опц.) значение аянамши в градусах
  houseCusps?: number[];  // (опц.) 12 значений-куспов домов, [0..360)
}

export interface Provider {
  getCore(input: BirthInput): Promise<CoreApiResponse>;
}

export type SignIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11; // 0=Овен
export type HouseNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export interface DMS { deg: number; min: number; sec: number; }
export interface NakshatraInfo { index: number; name: string; pada: 1|2|3|4; }

export interface PlanetPlacement {
  key: PlanetKey;
  lon: number;                  // 0..360 сидерическая долгота
  sign: SignIndex;              // знак (0=Овен,...)
  signName: string;             // "Овен" / "Телец" и т.д.
  degInSign: number;            // градусы в знаке [0..30)
  dmsInSign: DMS;               // градусы-минуты-секунды в знаке
  house: HouseNumber;           // дом (от лагны)
  nakshatra: NakshatraInfo;     // накшатра и пада
}

export interface ChartSlice {
  asc: PlanetPlacement;         // лагна как «планета»
  houses: { house: HouseNumber; sign: SignIndex; signName: string }[];
  planets: PlanetPlacement[];   // планеты (без Asc)
}

export interface VedicCharts {
  meta: {
    system: "sidereal-lahiri";
    ayanamsha?: number;
    nodeType: "true" | "mean";
  };
  D1: ChartSlice;   // Rāśi
  D9: ChartSlice;   // Navāṁśa
}

export const RASHI_RU = [
  "Овен","Телец","Близнецы","Рак","Лев","Дева",
  "Весы","Скорпион","Стрелец","Козерог","Водолей","Рыбы"
];

export const NAKSHATRAS_RU = [
  "Ашвини","Бхарани","Криттика","Рохини","Мригашира","Ардра","Пунарвасу",
  "Пушья","Ашлеша","Магха","Пурва Пхалгуни","Уттара Пхалгуни","Хаста",
  "Читра","Свати","Вишакха","Ануратха","Джйештха","Мула","Пурва Ашадха",
  "Уттара Ашадха","Шравана","Дхаништха","Шатабхиша","Пурва Бхадрапада",
  "Уттара Бхадрапада","Ревати"
];

/////////////////////////
// Утилиты вычислений //
/////////////////////////

const mod = (a:number, n:number) => ((a % n) + n) % n;
const clamp0_360 = (x:number) => mod(x, 360);

function toDMS(x:number): DMS {
  const deg = Math.floor(x);
  const mFloat = (x - deg) * 60;
  const min = Math.floor(mFloat);
  const sec = Math.round((mFloat - min) * 60);
  return { deg, min, sec };
}

function signOfLongitude(lon:number): SignIndex {
  return Math.floor(mod(lon,360) / 30) as SignIndex;
}
function degInSign(lon:number): number {
  return mod(lon, 30);
}

function nakshatraOfLongitude(lon:number): NakshatraInfo {
  const lonN = clamp0_360(lon);
  // 1 накшатра = 13°20' = 13 + 20/60 = 13.333333...
  const size = 13 + 20/60;
  const idx = Math.floor(lonN / size); // 0..26
  const padaSize = size / 4; // 3°20' = 3.333...
  const pada = (Math.floor(mod(lonN - idx*size, size) / padaSize) + 1) as 1|2|3|4;
  return { index: idx, name: NAKSHATRAS_RU[idx], pada };
}

function planetToPlacement(
  key: PlanetKey,
  lon: number,
  ascSign: SignIndex
): PlanetPlacement {
  const sign = signOfLongitude(lon);
  const dInSign = degInSign(lon);
  const house = ((sign - ascSign + 12) % 12 + 1) as HouseNumber;
  return {
    key,
    lon: clamp0_360(lon),
    sign,
    signName: RASHI_RU[sign],
    degInSign: dInSign,
    dmsInSign: toDMS(dInSign),
    house,
    nakshatra: nakshatraOfLongitude(lon),
  };
}

/////////////////////////////
// D9 (Navāṁśa) алгоритм  //
/////////////////////////////

/**
 * Правило старта последовательности Навамша:
 * - Подвижные (movable): Овен, Рак, Весы, Козерог — старт с самого знака
 * - Постоянные (fixed): Телец, Лев, Скорпион, Водолей — старт с 9-го от знака
 * - Двойственные (dual): Близнецы, Дева, Стрелец, Рыбы — старт с 5-го от знака
 */
const MOVABLE = new Set<SignIndex>([0,3,6,9]);
const FIXED   = new Set<SignIndex>([1,4,7,10]);
const DUAL    = new Set<SignIndex>([2,5,8,11]);

function navamshaStart(sign: SignIndex): number {
  if (MOVABLE.has(sign)) return sign;
  if (FIXED.has(sign))   return (sign + 8) % 12; // 9-й от знака
  return (sign + 4) % 12;                        // 5-й от знака (dual)
}

function navamshaSignOfLongitude(lon:number): SignIndex {
  const s = signOfLongitude(lon);
  const posInSign = degInSign(lon);               // [0..30)
  const navIndex = Math.floor(posInSign * 0.3);   // 30° / 9 = 3.333..., т.е. *9/30
  const start = navamshaStart(s);
  return mod(start + navIndex, 12) as SignIndex;
}

/////////////////////////
// Основная сборка D1 //
/////////////////////////

function buildD1(core: CoreApiResponse): ChartSlice {
  const asc = core.planets.find(p => p.key === "Asc");
  if (!asc) throw new Error("Asc (лагна) не получена от провайдера");

  const ascSign = signOfLongitude(asc.lon);
  const ascPlacement = planetToPlacement("Asc", asc.lon, ascSign);

  // Знаки домов D1 по лагне:
  const houses = Array.from({length:12}, (_,i) => {
    const sign = mod(ascSign + i, 12) as SignIndex;
    return { house: (i+1) as HouseNumber, sign, signName: RASHI_RU[sign] };
  });

  const planets = core.planets
    .filter(p => p.key !== "Asc")
    .map(p => planetToPlacement(p.key, p.lon, ascSign));

  return { asc: ascPlacement, houses, planets };
}

/////////////////////////
// Сборка D9 (Navamsa) //
/////////////////////////

function buildD9(core: CoreApiResponse): ChartSlice {
  const asc = core.planets.find(p => p.key === "Asc");
  if (!asc) throw new Error("Asc (лагна) не получена от провайдера");

  // D9-лагна — это знак Навамша для долготы лагны:
  const ascD9Sign = navamshaSignOfLongitude(asc.lon);
  const ascD9LonSynthetic = ascD9Sign * 30; // для UI достаточно «знака»; градусы несущественны
  const ascPlacement = planetToPlacement("Asc", ascD9LonSynthetic, ascD9Sign);

  const houses = Array.from({length:12}, (_,i) => {
    const sign = mod(ascD9Sign + i, 12) as SignIndex;
    return { house: (i+1) as HouseNumber, sign, signName: RASHI_RU[sign] };
  });

  const planets = core.planets
    .filter(p => p.key !== "Asc")
    .map(p => {
      const d9Sign = navamshaSignOfLongitude(p.lon);
      const syntheticLon = d9Sign * 30 +  // знак
        (degInSign(p.lon) % (30/9));      // опц.: можно утащить «остаток» в пределах навамши
      return planetToPlacement(p.key, syntheticLon, ascD9Sign);
    });

  return { asc: ascPlacement, houses, planets };
}

/////////////////////////////////////
// Публичный фасад для всего модуля //
/////////////////////////////////////

export async function buildVedicCharts(
  input: BirthInput,
  provider: Provider
): Promise<VedicCharts> {

  const core = await provider.getCore({
    ...input,
    nodeType: input.nodeType ?? "true",
  });

  // Если Раху пришёл, досчитаем Кету; если нет — пусть провайдер даёт оба.
  const hasRahu = core.planets.some(p => p.key === "Rahu");
  const hasKetu = core.planets.some(p => p.key === "Ketu");
  if (hasRahu && !hasKetu) {
    const rahu = core.planets.find(p => p.key === "Rahu")!;
    core.planets.push({ key: "Ketu", lon: clamp0_360(rahu.lon + 180) });
  }

  const D1 = buildD1(core);
  const D9 = buildD9(core);

  return {
    meta: { system: "sidereal-lahiri", ayanamsha: core.ayanamsha, nodeType: input.nodeType ?? "true" },
    D1, D9
  };
}

/////////////////////////////////////////////
// Базовая реализация провайдера (пример) //
/////////////////////////////////////////////

/**
 * Пример адаптера под Prokerala (или похожее API).
 * Ожидается, что API сразу отдаёт СИДЕРИЧЕСКИЕ долготы (Лахири).
 * Если отдаёт тропические — провайдер должен сам вычесть аянамшу.
 */
export class ProkeralaProvider implements Provider {
  constructor(private apiKey: string) {}

  private async call<T>(url:string, payload:any): Promise<T> {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`API error ${res.status}: ${txt}`);
    }
    return res.json() as Promise<T>;
  }

  async getCore(input: BirthInput): Promise<CoreApiResponse> {
    const datetimeLocal = `${input.date}T${input.time}:00`;
    // Если у API поле timezone ожидается в минутах — конвертируй здесь.
    const payload = {
      datetime: datetimeLocal,
      latitude: input.lat,
      longitude: input.lon,
      timezone: input.tz,          // часы, например 3 или -5
      node_type: input.nodeType ?? "true",
      ayanamsha: "lahiri"
    };

    // Ниже оформлены «примерные» вызовы; подставь реальные endpoints
    // согласно провайдеру, просто маппинг оставь тем же.

    type PlanetAPI = { name:string; longitude:number; };
    type AscAPI    = { ascendant:number };
    type AyanAPI   = { ayanamsha:number };

    // 1) Планеты + лагна
    const planetsResp = await this.call<{ planets:PlanetAPI[]; ascendant:AscAPI; ayanamsha?:AyanAPI }>(
      "https://api.example.com/astrology/vedic/positions",
      payload
    );

    // Маппинг названий -> наши ключи
    const mapName = (n:string): PlanetKey | null => {
      const k = n.toLowerCase();
      if (k.includes("sun")) return "Sun";
      if (k.includes("moon")) return "Moon";
      if (k.includes("mars")) return "Mars";
      if (k.includes("mercury")) return "Mercury";
      if (k.includes("jupiter")) return "Jupiter";
      if (k.includes("venus")) return "Venus";
      if (k.includes("saturn")) return "Saturn";
      if (k.includes("rahu") || k.includes("north")) return "Rahu";
      if (k.includes("ketu") || k.includes("south")) return "Ketu";
      return null;
    };

    const planets: PlanetRaw[] = [];
    for (const p of planetsResp.planets) {
      const key = mapName(p.name);
      if (key) planets.push({ key, lon: clamp0_360(p.longitude) });
    }

    planets.push({ key: "Asc", lon: clamp0_360(planetsResp.ascendant.ascendant) });

    // 2) (опц.) куспы домов
    let houseCusps: number[] | undefined;
    try {
      const housesResp = await this.call<{ cusps:number[] }>(
        "https://api.example.com/astrology/vedic/house-cusps",
        payload
      );
      if (Array.isArray(housesResp.cusps) && housesResp.cusps.length >= 12) {
        houseCusps = housesResp.cusps.slice(0,12).map(clamp0_360);
      }
    } catch(_) { /* необязательный вызов */ }

    const ayanamshaVal = planetsResp.ayanamsha?.ayanamsha;

    return { planets, houseCusps, ayanamsha: ayanamshaVal };
  }
}

/**
 * Простейший «мок»-провайдер для локальной отладки без сети.
 * Передай свои долготы — модуль соберёт карты.
 */
export class MockProvider implements Provider {
  constructor(private mock: CoreApiResponse) {}
  async getCore(): Promise<CoreApiResponse> { return this.mock; }
}

//////////////////////
// Пример использования
//////////////////////

/*
import { buildVedicCharts, ProkeralaProvider } from "./vedicChart";

const provider = new ProkeralaProvider(process.env.PROKERALA_KEY!);

const charts = await buildVedicCharts({
  date: "1985-06-09",
  time: "14:45",
  tz: 3,
  lat: 55.7558,
  lon: 37.6176,
}, provider);

// charts.D1 / charts.D9 готовы для визуализации
*/
