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
    
    const data = await response.json();
    
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
