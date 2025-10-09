export function parseBirthDate(dateStr: string, timezone: number): Date {
  const [d, t] = dateStr.split("T");
  const [year, month, day] = d.split("-").map(Number);
  const [hour, minute] = t.split(":").map(Number);

  return new Date(Date.UTC(year, month - 1, day, hour - timezone, minute));
}

export function convertDateFormat(dateStr: string): string {
  const [day, month, year] = dateStr.split(".");
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}
