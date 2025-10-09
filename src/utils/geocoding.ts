export function getTimezoneFromLongitude(lon: number): number {
  if (lon >= -180 && lon < -150) return -12; // Гавайи
  if (lon >= -150 && lon < -120) return -10; // Аляска
  if (lon >= -120 && lon < -60) return -8;   // Тихоокеанское время
  if (lon >= -60 && lon < -30) return -5;    // Восточное время
  if (lon >= -30 && lon < 0) return -3;      // Атлантическое время
  if (lon >= 0 && lon < 30) return 0;        // GMT
  if (lon >= 30 && lon < 60) return 2;       // Восточная Европа
  if (lon >= 60 && lon < 90) return 3;       // Москва
  if (lon >= 90 && lon < 120) return 5;      // Екатеринбург
  if (lon >= 120 && lon < 150) return 7;     // Красноярск
  if (lon >= 150 && lon < 180) return 9;     // Владивосток
  return 0; // По умолчанию GMT
}
