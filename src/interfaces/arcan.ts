export interface AwakeningCodes {
  core: string;
  fear: string;
  implementation: string;
};

interface ArcanumCode {
  arcanum: number;
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
  arcanum: number;
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
