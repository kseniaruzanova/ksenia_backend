export interface AwakeningCodes {
  core: string;
  fear: string;
  implementation: string;
};

interface ArcanumCode {
  arcanum: number | string;
  text: string;
};

export interface AwakeningCodesData {
  core: ArcanumCode;
  fear: ArcanumCode;
  implementation: ArcanumCode;
};

export interface MistakesIncarnationData {
  lessonIncarnation: ArcanumCode;
  karmicLessons: ArcanumCode;
};

interface ArcanumItem {
  arcanum: number | string;
  text: string;
}

export interface RitualItem {
  title: string;
  text: string;
}

export interface FinancialCastData {
  moneyKnot: ArcanumItem;
  archetypePoverty: ArcanumItem;
  duty: ArcanumItem;
  shadowWealth: ArcanumItem;
  ritualsMap: RitualItem[];
}

export interface MonthlyForecast {
  monthName: string;
  exam: ArcanumItem;
  risk: ArcanumItem;
}

export interface ForecastData {
  yearDoor: ArcanumItem;
  events: ArcanumItem;
  monthlyForecasts: MonthlyForecast[];
}

export interface MatrixCodes {
  richCodes: string[];
  marriageCodes: string[];
  profitableMarriageCodes: string[];
  childIssueCodes: string[];
  oncologyCodes: string[];
  accidentCodes: string[];
  foreignMarriageCodes: string[];
  instabilityCodes: string[];
  psychProblemsCodes: string[];
  lonelinessCodes: string[];
}

export interface MatrixLife {
  matrix: number[][];
  codes: MatrixCodes;
};

export interface MatrixLifeData {
  matrix: number[][];
  codes: MatrixCodes;
};

export interface KarmicTail {
  personalPurpose: string;
  socialPurpose: string;
  spiritualPurpose: string;
  planetaryPurpose: string;
  kamaciTail: string;
  lessonSoul: string;
  karmaPast: string;
  financeCenter: string;
};

export interface KarmicTailData {
  personalPurpose: ArcanumCode;
  socialPurpose: ArcanumCode;
  spiritualPurpose: ArcanumCode;
  planetaryPurpose: ArcanumCode;
  kamaciTail: ArcanumCode;
  lessonSoul: ArcanumCode;
  karmaPast: ArcanumCode;
  financeCenter: ArcanumCode;
};

export interface ArchetypeShadowData {
  first: ArcanumCode;
  second: ArcanumCode;
  third: ArcanumCode;
  fourth: ArcanumCode;
};

export interface ArchetypeMonthData {
  archetype: ArcanumCode;
};

export interface LifePeriod {
  periodNumber: number;
  fromAge: number;
  toAge: number | string;
  positiveEvents: string;
  karmicLessons: string;
}

export interface LifeMatrixData {
  matrix: number[][];
  birthDayArcanum: ArcanumCode;
  yearArcanum: ArcanumCode;
  higherForcesTaskArcanum: ArcanumCode;
  incarnationLesson: ArcanumCode;
  selfRealizationArcanum: ArcanumCode;
  lifePeriods: LifePeriod[];
};

export interface StagnationCycleData {
  stagnation: ArcanumCode;
  cycle: ArcanumCode;
  strike: ArcanumCode;
  exit1: ArcanumCode;
  exit2: ArcanumCode;
  exit3: ArcanumCode;
};