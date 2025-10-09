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
