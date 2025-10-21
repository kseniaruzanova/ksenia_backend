import { Request, Response } from 'express';
import { AuthRequest } from '../interfaces/authRequest';
import path from 'path';

// Загрузка изображений
export const uploadImages = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      return res.status(400).json({ error: 'No images uploaded' });
    }

    const imageUrls = req.files.map(file => {
      return `/api/uploads/images/${file.filename}`;
    });

    console.log(`✅ Uploaded ${imageUrls.length} images`);
    
    res.status(200).json({ imageUrls });
  } catch (error: any) {
    console.error('❌ Error uploading images:', error);
    res.status(500).json({ 
      error: 'Failed to upload images', 
      details: error.message 
    });
  }
};

// Загрузка аудио
export const uploadAudio = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file uploaded' });
    }

    const audioUrl = `/api/uploads/audio/${req.file.filename}`;

    console.log(`✅ Uploaded audio: ${audioUrl}`);
    
    res.status(200).json({ audioUrl });
  } catch (error: any) {
    console.error('❌ Error uploading audio:', error);
    res.status(500).json({ 
      error: 'Failed to upload audio', 
      details: error.message 
    });
  }
};

