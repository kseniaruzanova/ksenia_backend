import { Request, Response } from 'express';
import { catchAsync } from '../lib/catchAsync';

export const searchCities = catchAsync(async (req: Request, res: Response) => {
  const { q, limit = 10 } = req.query;
  
  if (!q || typeof q !== 'string') {
    return res.status(400).json({ error: 'Query parameter "q" is required' });
  }

  const searchLimit = Math.min(parseInt(limit as string) || 10, 50);
  
  try {
    // Проксируем запрос к Nominatim API
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?` +
      `q=${encodeURIComponent(q)}&` +
      `format=json&` +
      `addressdetails=1&` +
      `limit=${searchLimit}&` +
      `countrycodes=by,ru,us,gb,de,fr,it,es,ca,au,jp,cn,kr,sg,th,ae,in,nz,eg,za,ng,br,ar,pe,cl,mx&` +
      `featuretype=city,town,village`,
      {
        headers: {
          'User-Agent': 'AstroApp/1.0'
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Nominatim API error: ${response.status}`);
    }
    
    const data = await response.json() as any[];
    
    res.json({
      success: true,
      cities: data.map((city: any) => ({
        place_id: city.place_id,
        display_name: city.display_name,
        lat: city.lat,
        lon: city.lon,
        type: city.type,
        importance: city.importance
      }))
    });
  } catch (error) {
    console.error('Error searching cities:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to search cities' 
    });
  }
});

export const getTimezone = catchAsync(async (req: Request, res: Response) => {
  const { lat, lon } = req.query;
  
  if (!lat || !lon) {
    return res.status(400).json({ error: 'Parameters "lat" and "lon" are required' });
  }

  const latitude = parseFloat(lat as string);
  const longitude = parseFloat(lon as string);
  
  if (isNaN(latitude) || isNaN(longitude)) {
    return res.status(400).json({ error: 'Invalid latitude or longitude values' });
  }

  if (latitude < -90 || latitude > 90) {
    return res.status(400).json({ error: 'Latitude must be between -90 and 90' });
  }

  if (longitude < -180 || longitude > 180) {
    return res.status(400).json({ error: 'Longitude must be between -180 and 180' });
  }
  
  try {
    // Используем TimeZoneDB API для получения точного часового пояса
    const apiKey = process.env.TIMEZONEDB_API_KEY || 'demo';
    const response = await fetch(
      `http://api.timezonedb.com/v2.1/get-time-zone?` +
      `key=${apiKey}&` +
      `format=json&` +
      `by=position&` +
      `lat=${latitude}&` +
      `lng=${longitude}`,
      {
        headers: {
          'User-Agent': 'AstroApp/1.0'
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`TimeZoneDB API error: ${response.status}`);
    }
    
    const data = await response.json() as any;
    
    if (data.status !== 'OK') {
      throw new Error(`TimeZoneDB API error: ${data.message || 'Unknown error'}`);
    }
    
    // Извлекаем часовой пояс в формате UTC offset (например, +3, -5)
    const utcOffset = data.gmtOffset / 3600; // конвертируем секунды в часы
    
    res.json({
      success: true,
      timezone: {
        utcOffset: utcOffset,
        timezoneId: data.zoneName,
        timezoneName: data.abbreviation,
        countryCode: data.countryCode,
        countryName: data.countryName
      }
    });
  } catch (error) {
    console.error('Error getting timezone:', error);
    
    // Fallback к простому определению по долготе
    const fallbackTimezone = getTimezoneFromLongitude(longitude);
    
    res.json({
      success: true,
      timezone: {
        utcOffset: fallbackTimezone,
        timezoneId: 'Unknown',
        timezoneName: `UTC${fallbackTimezone >= 0 ? '+' : ''}${fallbackTimezone}`,
        countryCode: 'Unknown',
        countryName: 'Unknown'
      },
      fallback: true
    });
  }
});

export const getFirstCity = catchAsync(async (req: Request, res: Response) => {
  const { q } = req.query;
  
  if (!q || typeof q !== 'string') {
    return res.status(400).json({ error: 'Query parameter "q" is required' });
  }
  
  try {
    // Проксируем запрос к Nominatim API для получения только первого результата
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?` +
      `q=${encodeURIComponent(q)}&` +
      `format=json&` +
      `addressdetails=1&` +
      `limit=1&` +
      `countrycodes=by,ru,us,gb,de,fr,it,es,ca,au,jp,cn,kr,sg,th,ae,in,nz,eg,za,ng,br,ar,pe,cl,mx&` +
      `featuretype=city,town,village`,
      {
        headers: {
          'User-Agent': 'AstroApp/1.0'
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Nominatim API error: ${response.status}`);
    }
    
    const data = await response.json() as any[];
    
    if (data.length === 0) {
      return res.json({
        success: true,
        city: null,
        message: 'No cities found for the given query'
      });
    }
    
    const firstCity = data[0];
    const latitude = parseFloat(firstCity.lat);
    const longitude = parseFloat(firstCity.lon);
    
    // Получаем часовой пояс для найденного города
    let timezoneData = null;
    try {
      const apiKey = process.env.TIMEZONEDB_API_KEY || 'demo';
      const timezoneResponse = await fetch(
        `http://api.timezonedb.com/v2.1/get-time-zone?` +
        `key=${apiKey}&` +
        `format=json&` +
        `by=position&` +
        `lat=${latitude}&` +
        `lng=${longitude}`,
        {
          headers: {
            'User-Agent': 'AstroApp/1.0'
          }
        }
      );
      
      if (timezoneResponse.ok) {
        const timezoneResult = await timezoneResponse.json() as any;
        if (timezoneResult.status === 'OK') {
          timezoneData = {
            utcOffset: timezoneResult.gmtOffset / 3600,
            timezoneId: timezoneResult.zoneName,
            timezoneName: timezoneResult.abbreviation,
            countryCode: timezoneResult.countryCode,
            countryName: timezoneResult.countryName
          };
        }
      }
    } catch (timezoneError) {
      console.warn('Failed to get timezone, using fallback:', timezoneError);
    }
    
    // Fallback к простому определению по долготе, если API не сработал
    if (!timezoneData) {
      const fallbackTimezone = getTimezoneFromLongitude(longitude);
      timezoneData = {
        utcOffset: fallbackTimezone,
        timezoneId: 'Unknown',
        timezoneName: `UTC${fallbackTimezone >= 0 ? '+' : ''}${fallbackTimezone}`,
        countryCode: 'Unknown',
        countryName: 'Unknown'
      };
    }
    
    res.json({
      success: true,
      city: {
        place_id: firstCity.place_id,
        display_name: firstCity.display_name,
        lat: firstCity.lat,
        lon: firstCity.lon,
        type: firstCity.type,
        importance: firstCity.importance,
        timezone: timezoneData
      }
    });
  } catch (error) {
    console.error('Error getting first city:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get first city' 
    });
  }
});

// Простая функция определения часового пояса по долготе (fallback)
function getTimezoneFromLongitude(lon: number): number {
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