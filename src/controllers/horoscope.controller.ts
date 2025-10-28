import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';

export const horoscopeController = {
  async getHoroscope(req: Request, res: Response) {
    try {
      const { planet, sign } = req.params;

      // Валидация планеты
      const validPlanets = ['jupiter', 'venus', 'mercury', 'saturn'];
      const planetLower = planet.toLowerCase();
      
      if (!validPlanets.includes(planetLower)) {
        return res.status(400).json({ error: 'Неверная планета' });
      }

      // Валидация знака (1-12)
      const signNumber = parseInt(sign);
      if (isNaN(signNumber) || signNumber < 1 || signNumber > 12) {
        return res.status(400).json({ error: 'Неверный знак зодиака' });
      }

      // Получаем путь к файлу
      const filePath = path.join(
        process.cwd(),
        'src',
        'data',
        'natal',
        planetLower,
        `${signNumber}.pdf`
      );

      // Проверяем существование файла
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Гороскоп не найден' });
      }

      // Отправляем файл
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${planetLower}_sign${signNumber}.pdf"`);
      res.sendFile(filePath);

    } catch (error: any) {
      console.error('Error getting horoscope:', error);
      res.status(500).json({ error: 'Ошибка при получении гороскопа' });
    }
  }
};

