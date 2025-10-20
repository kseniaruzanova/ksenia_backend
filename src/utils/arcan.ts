import path from "path";

export function toArcana(sum: number): number {
  while (sum > 22) {
    sum -= 22;
  }
  return sum;
}

export function getArcanFilePath(
  finalNumber: string | number,
  baseDir: string = __dirname,
  subDirs: string[] = ["..", "..", "src", "data", "arcanumRealization"]
): string {
  return path.join(
    baseDir,
    ...subDirs,
    `arcan_${finalNumber}.pdf`
  );
}

export function splitNumberIntoDigits(num: number): number[] {
  const str: string = num.toString();
  const digits: number[] = str.split('').map(Number);
  
  if (digits.length === 1) {
    return [digits[0], 0];
  } else {
    return digits.slice(0, 2);
  }
}

export const normalizeToArcana = (value: number): number => {
  if (value > 22) {
    const digits = splitNumberIntoDigits(value);
    return digits[0] + digits[1];
  }
  return value;
};

export function getBirthDateSum(birthDate: string): number {
  const parts = birthDate.split(".");
  if (parts.length !== 3) return 0;
  const allDigits = parts.join("").split("");
  return allDigits.reduce((sum, d) => sum + parseInt(d, 10), 0);
}
