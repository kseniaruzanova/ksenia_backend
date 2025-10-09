export function norm360(deg: number): number {
  let x = deg % 360;
  if (x < 0) x += 360;
  return x;
}

export function deltaAngle(a: number, b: number): number {
  // кратчайшая разница углов (a->b) в диапазоне [-180..+180]
  let d = (b - a + 540) % 360 - 180;
  return d;
}

export function absDelta(a: number, b: number): number {
  return Math.abs(deltaAngle(a, b));
}
