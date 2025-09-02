export interface ZodiacSign {
  sign: string;
  degree: number;
  minute: number;
  second: number;
}

export interface PlanetPosition {
  name: string;
  longitude: number;
  latitude: number;
  distance: number;
  speed: number;
  retrograde: boolean;
  zodiacSign: ZodiacSign;
  nakshatra?: string;
  pada?: number;
}

export interface HouseCusp {
  house: number;
  position: number;
  zodiacSign: ZodiacSign;
}

export interface IndianChart extends NatalChart {
  nakshatra: Nakshatra;
  pada: number;
  tithi: string;
  yoga: string;
  karana: string;
  ascendantNakshatra: Nakshatra;
  ascendantPada: number;
}


export interface Nakshatra {
  name: string;
  number: number;
  lord: string;
  start: number;
  end: number;
}

export interface Aspect {
  planet1: string;
  planet2: string;
  angle: number;
  type: 'conjunction' | 'opposition' | 'trine' | 'square' | 'sextile' | 'quincunx';
  orb: number;
  exact: boolean;
  influence: 'positive' | 'negative' | 'neutral';
}

export interface NatalChart {
  planets: PlanetPosition[];
  houses: HouseCusp[];
  ascendant: number;
  midheaven: number;
  date: Date;
  location: {
    latitude: number;
    longitude: number;
    timezone: number;
  };
}

export interface EphemerisConfig {
  ephemerisPath: string;
  flags: number;
}

export interface CalculationResult {
  positions: number[];
  error?: string;
}
