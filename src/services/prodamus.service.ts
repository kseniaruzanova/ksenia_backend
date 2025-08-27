export function createProdamusPayLink(
  subdomain: string,
  options: Record<string, string | number | boolean>
): string {
  const base = `https://${subdomain}.payform.ru/`;

  const params = new URLSearchParams({ do: "pay" });

  // добавляем кастомные параметры
  for (const [key, value] of Object.entries(options)) {
    if (typeof value !== "undefined" && value !== null) {
      params.append(key, String(value));
    }
  }


  return `${base}?${params.toString()}`;
}
