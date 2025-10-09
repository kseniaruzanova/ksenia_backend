export function isInRange(day: number, month: number, start: {m: number, d: number}, end: {m: number, d: number}) {
  if (start.m < end.m || (start.m === end.m && start.d <= end.d)) {
    if (
      (month > start.m || (month === start.m && day >= start.d)) &&
      (month < end.m || (month === end.m && day <= end.d))
    ) {
      return true;
    }
  } else {
    if (
      (month > start.m || (month === start.m && day >= start.d)) ||
      (month < end.m || (month === end.m && day <= end.d))
    ) {
      return true;
    }
  }
  return false;
}

export function getMonthlyHoroscopeForZodiac(zodiacNum: string | number, periodNum: string | number, monthlyHoroscope: Record<string, string>): string {
  const zodiac = typeof zodiacNum === "string" ? parseInt(zodiacNum, 10) : zodiacNum;
  const period = typeof periodNum === "string" ? parseInt(periodNum, 10) : periodNum;

  const index = ((Number(period) - Number(zodiac) + 12) % 12) + 1;
  return monthlyHoroscope[String(index)];
}
