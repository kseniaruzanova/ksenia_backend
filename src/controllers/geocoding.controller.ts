import { Request, Response } from "express";
import { getTimezoneFromLongitude } from "../utils/geocoding";

export const searchCities = async (req: Request, res: Response) => {
  const { q, limit = 10 } = req.query;
  
  if (!q || typeof q !== 'string') {
    return res.status(400).json({ error: 'Query parameter "q" is required' });
  }

  const searchLimit: number = Math.min(parseInt(limit as string) || 10, 50);
  
  try {
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
    
    res.status(200).json({
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
    res.status(500).json({ 
      success: false, 
      error: 'Failed to search cities' 
    });
  }
};

export const getTimezone = async (req: Request, res: Response) => {
  const { lat, lon } = req.query;
  
  if (!lat || !lon) {
    return res.status(400).json({ error: 'Parameters "lat" and "lon" are required' });
  }

  const latitude: number = parseFloat(lat as string);
  const longitude: number = parseFloat(lon as string);
  
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
    const apiKey: string = process.env.TIMEZONEDB_API_KEY || 'demo';
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
    
    const utcOffset: number = data.gmtOffset / 3600;
    
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
    const fallbackTimezone: number = getTimezoneFromLongitude(longitude);
    
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
};

// @TODO
// export const getFirstCity = async (req: Request, res: Response) => {
//   const { q } = req.query;
  
//   if (!q || typeof q !== 'string') {
//     return res.status(400).json({ error: 'Query parameter "q" is required' });
//   }
  
//   try {
//     // Проксируем запрос к Nominatim API для получения только первого результата
//     const response = await fetch(
//       `https://nominatim.openstreetmap.org/search?` +
//       `q=${encodeURIComponent(q)}&` +
//       `format=json&` +
//       `addressdetails=1&` +
//       `limit=1&` +
//       `countrycodes=by,ru,us,gb,de,fr,it,es,ca,au,jp,cn,kr,sg,th,ae,in,nz,eg,za,ng,br,ar,pe,cl,mx&` +
//       `featuretype=city,town,village`,
//       {
//         headers: {
//           'User-Agent': 'AstroApp/1.0'
//         }
//       }
//     );
    
//     if (!response.ok) {
//       throw new Error(`Nominatim API error: ${response.status}`);
//     }
    
//     const data = await response.json() as any[];
    
//     if (data.length === 0) {
//       return res.json({
//         success: true,
//         city: null,
//         message: 'No cities found for the given query'
//       });
//     }
    
//     const firstCity = data[0];
//     const latitude = parseFloat(firstCity.lat);
//     const longitude = parseFloat(firstCity.lon);
    
//     // Получаем часовой пояс для найденного города
//     let timezoneData = null;
//     try {
//       const apiKey = process.env.TIMEZONEDB_API_KEY || 'demo';
//       const timezoneResponse = await fetch(
//         `http://api.timezonedb.com/v2.1/get-time-zone?` +
//         `key=${apiKey}&` +
//         `format=json&` +
//         `by=position&` +
//         `lat=${latitude}&` +
//         `lng=${longitude}`,
//         {
//           headers: {
//             'User-Agent': 'AstroApp/1.0'
//           }
//         }
//       );
      
//       if (timezoneResponse.ok) {
//         const timezoneResult = await timezoneResponse.json() as any;
//         if (timezoneResult.status === 'OK') {
//           timezoneData = {
//             utcOffset: timezoneResult.gmtOffset / 3600,
//             timezoneId: timezoneResult.zoneName,
//             timezoneName: timezoneResult.abbreviation,
//             countryCode: timezoneResult.countryCode,
//             countryName: timezoneResult.countryName
//           };
//         }
//       }
//     } catch (timezoneError) {
//       console.warn('Failed to get timezone, using fallback:', timezoneError);
//     }
    
//     // Fallback к простому определению по долготе, если API не сработал
//     if (!timezoneData) {
//       const fallbackTimezone = getTimezoneFromLongitude(longitude);
//       timezoneData = {
//         utcOffset: fallbackTimezone,
//         timezoneId: 'Unknown',
//         timezoneName: `UTC${fallbackTimezone >= 0 ? '+' : ''}${fallbackTimezone}`,
//         countryCode: 'Unknown',
//         countryName: 'Unknown'
//       };
//     }
    
//     res.json({
//       success: true,
//       city: {
//         place_id: firstCity.place_id,
//         display_name: firstCity.display_name,
//         lat: firstCity.lat,
//         lon: firstCity.lon,
//         type: firstCity.type,
//         importance: firstCity.importance,
//         timezone: timezoneData
//       }
//     });
//   } catch (error) {
//     console.error('Error getting first city:', error);
//     res.status(500).json({ 
//       success: false, 
//       error: 'Failed to get first city' 
//     });
//   }
// };
