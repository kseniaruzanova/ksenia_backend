import { norm360 } from "./angles";

export interface ZodiacSign {
  sign: string;
  degree: number;
  minute: number;
  second: number;
}

export const ZODIAC_SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 
  'Leo', 'Virgo', 'Libra', 'Scorpio', 
  'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
];

export function degreesToSign(longitude: number): ZodiacSign {
  const totalDegrees = norm360(longitude);
  const signIndex = Math.floor(totalDegrees / 30);
  const degreesInSign = totalDegrees % 30;
  
  const degree = Math.floor(degreesInSign);
  const minutesDecimal = (degreesInSign - degree) * 60;
  const minute = Math.floor(minutesDecimal);
  const second = Math.round((minutesDecimal - minute) * 60);
  
  return {
    sign: ZODIAC_SIGNS[signIndex],
    degree,
    minute,
    second
  };
}

export function signEmoji(sign: string): string {
  const emojis: { [key: string]: string } = {
    'Aries': '♈',
    'Taurus': '♉',
    'Gemini': '♊',
    'Cancer': '♋',
    'Leo': '♌',
    'Virgo': '♍',
    'Libra': '♎',
    'Scorpio': '♏',
    'Sagittarius': '♐',
    'Capricorn': '♑',
    'Aquarius': '♒',
    'Pisces': '♓'
  };
  return emojis[sign] || '';
}

export function formatZodiacPosition(sign: ZodiacSign): string {
  return `${sign.degree}°${sign.minute}'${sign.second}" ${sign.sign} ${signEmoji(sign.sign)}`;
}