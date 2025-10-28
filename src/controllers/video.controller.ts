import { Request, RequestHandler, Response } from "express";
import fs from "fs";
import path from "path";
import Video from "../models/video.model";

// Пути для сохранения файлов (Docker-friendly: /app/uploads/)
const uploadsDir = path.join(process.cwd(), 'uploads');
const videosDir = path.join(uploadsDir, 'videos');
const thumbsDir = path.join(videosDir, 'thumbnails');

function ensureDirs(): void {
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  if (!fs.existsSync(videosDir)) fs.mkdirSync(videosDir, { recursive: true });
  if (!fs.existsSync(thumbsDir)) fs.mkdirSync(thumbsDir, { recursive: true });
}

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_.-]/g, '_');
}

// Backwards compatibility no-op initializers
export const initGridFS = () => {
  ensureDirs();
};

export const getGridFSBuckets = () => ({ videoBucket: null, thumbnailBucket: null });

// Middleware для отслеживания прогресса загрузки
export const uploadProgressMiddleware: RequestHandler = (req, res, next) => {
  const contentLength = parseInt(req.headers['content-length'] || '0');
  if (contentLength <= 0) {
    return next();
  }
  let uploadedBytes = 0;
  req.on('data', (chunk: Buffer) => {
    uploadedBytes += chunk.length;
    const progress = Math.min((uploadedBytes / contentLength) * 100, 100);
    req.uploadProgress = progress;
    console.log(`Upload progress: ${progress.toFixed(2)}%`);
  });
  req.on('end', () => {
    req.uploadProgress = 100;
    console.log('Upload completed');
  });
  req.on('error', (error) => {
    console.error('Upload error:', error);
    req.uploadProgress = -1;
  });
  next();
};

// GET /api/videos
export const getVideos: RequestHandler = async (_req, res) => {
  try {
    const videos = await Video.find().sort({ createdAt: -1 });
    res.status(200).json(videos);
  } catch (error: any) {
    res.status(500).json({ message: 'Ошибка при получении видео', error: error?.message || String(error) });
  }
};

// POST /api/videos
export const createVideo: RequestHandler = async (req, res) => {
  try {
    ensureDirs();
    const body = req.body as any;
    const { title, description, type, source: sourceLink, playlistId, order } = body;

    if (!title || !type) {
      res.status(400).json({ message: 'Поля title и type обязательны' });
      return;
    }

    let source: string = '';
    let thumbnail: string | undefined = undefined;

    if (type === 'file') {
      if (req.files && 'video' in (req.files as any)) {
        const videoFile = (req.files as any).video?.[0];
        if (!videoFile?.buffer) {
          res.status(400).json({ message: 'Не найден файл видео' });
          return;
        }
        const uniqueName = `video_${Date.now()}_${sanitizeName(videoFile.originalname)}`;
        fs.writeFileSync(path.join(videosDir, uniqueName), videoFile.buffer);
        source = uniqueName;
      } else if (body.source) {
        source = sanitizeName(String(body.source));
      } else {
        res.status(400).json({ message: 'Для типа file требуется загрузить видео' });
        return;
      }
    } else if (type === 'link') {
      if (!sourceLink) {
        res.status(400).json({ message: 'Для типа link требуется поле source' });
        return;
      }
      source = String(sourceLink);
    } else {
      res.status(400).json({ message: 'Неверный тип видео' });
      return;
    }

    if (req.files && 'thumbnail' in (req.files as any)) {
      const thumbFile = (req.files as any).thumbnail?.[0];
      if (thumbFile?.buffer) {
        const uniqueThumb = `thumb_${Date.now()}_${sanitizeName(thumbFile.originalname)}`;
        fs.writeFileSync(path.join(thumbsDir, uniqueThumb), thumbFile.buffer);
        thumbnail = uniqueThumb;
      } else if (thumbFile?.originalname && /^https?:\/\//i.test(thumbFile.originalname)) {
        thumbnail = thumbFile.originalname;
      }
    } else if (body.thumbnailPath) {
      thumbnail = String(body.thumbnailPath);
    }

    const video = new Video({
      title,
      description: description || '',
      type: type as 'file' | 'link',
      source,
      thumbnail,
      playlistId: playlistId || null,
      order: typeof order === 'number' ? order : 0
    });

    const savedVideo = await video.save();
    res.status(201).json(savedVideo);
  } catch (error: any) {
    console.error('Ошибка в createVideo:', error);
    res.status(400).json({ message: 'Ошибка при создании видео', error: error?.message || String(error) });
  }
};

// PUT /api/videos/:id
export const updateVideo: RequestHandler = async (req, res) => {
  try {
    ensureDirs();
    const { id } = req.params;
    const body = req.body as any;
    const { title, description, type, source: sourceLink, playlistId, order } = body;

    const found = await Video.findById(id);
    if (!found) {
      res.status(404).json({ message: 'Видео не найдено' });
      return;
    }

    if (title !== undefined) found.title = title;
    if (description !== undefined) found.description = description;
    if (playlistId !== undefined) found.playlistId = playlistId || null;
    if (order !== undefined) found.order = typeof order === 'number' ? order : found.order;

    if (type && type !== found.type) {
      if (found.type === 'file' && typeof found.source === 'string' && found.source) {
        const oldPath = path.join(videosDir, found.source);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      found.type = type as 'file' | 'link';
    }

    if (req.files && 'video' in (req.files as any)) {
      const videoFile = (req.files as any).video?.[0];
      if (!videoFile?.buffer) {
        res.status(400).json({ message: 'Загруженный файл видео пуст' });
        return;
      }
      if (found.type === 'file' && found.source && typeof found.source === 'string') {
        const oldPath = path.join(videosDir, found.source);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      const uniqueName = `video_${Date.now()}_${sanitizeName(videoFile.originalname)}`;
      fs.writeFileSync(path.join(videosDir, uniqueName), videoFile.buffer);
      found.source = uniqueName;
      found.type = 'file';
    } else if (type === 'link' && sourceLink) {
      if (found.type === 'file' && typeof found.source === 'string' && found.source) {
        const oldPath = path.join(videosDir, found.source);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      found.source = String(sourceLink);
      found.type = 'link';
    } else if (body.source && found.type === 'file') {
      found.source = sanitizeName(String(body.source));
    }

    if (req.files && 'thumbnail' in (req.files as any)) {
      const thumbFile = (req.files as any).thumbnail?.[0];
      if (found.thumbnail && typeof found.thumbnail === 'string' && !/^https?:\/\//i.test(found.thumbnail)) {
        const oldThumb = path.join(thumbsDir, found.thumbnail);
        if (fs.existsSync(oldThumb)) fs.unlinkSync(oldThumb);
      }
      if (thumbFile?.buffer) {
        const uniqueThumb = `thumb_${Date.now()}_${sanitizeName(thumbFile.originalname)}`;
        fs.writeFileSync(path.join(thumbsDir, uniqueThumb), thumbFile.buffer);
        (found as any).thumbnail = uniqueThumb;
      } else if (thumbFile?.originalname && /^https?:\/\//i.test(thumbFile.originalname)) {
        (found as any).thumbnail = thumbFile.originalname;
      }
    } else if (body.thumbnailPath) {
      (found as any).thumbnail = String(body.thumbnailPath);
    }

    if (!found.source) {
      res.status(400).json({ message: 'Источник видео обязателен' });
      return;
    }

    await found.save();
    res.status(200).json({ message: 'Видео успешно обновлено', video: found });
  } catch (error: any) {
    console.error('Ошибка в updateVideo:', error);
    res.status(500).json({ message: 'Ошибка при обновлении видео', error: error?.message || 'Internal server error' });
  }
};

// DELETE /api/videos/:id
export const deleteVideo: RequestHandler = async (req, res) => {
  try {
    ensureDirs();
    const { id } = req.params;
    const found = await Video.findById(id);
    if (!found) {
      res.status(404).json({ message: 'Видео не найдено' });
      return;
    }

    if (found.type === 'file' && typeof found.source === 'string' && found.source) {
      const filePath = path.join(videosDir, found.source);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    if (found.thumbnail && typeof found.thumbnail === 'string' && !/^https?:\/\//i.test(found.thumbnail)) {
      const thumbPath = path.join(thumbsDir, found.thumbnail);
      if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
    }

    await found.deleteOne();
    res.status(200).json({ message: 'Видео удалено' });
  } catch (error: any) {
    console.error('Ошибка в deleteVideo:', error);
    res.status(500).json({ message: 'Ошибка при удалении видео', error: error?.message || String(error) });
  }
};

// GET /api/videos/file/:id  (now :id is the stored filename)
export const getFile: RequestHandler = async (req, res) => {
  try {
    ensureDirs();
    const filename = req.params.id;
    const videoPath = path.join(videosDir, filename);
    if (!fs.existsSync(videoPath)) {
      res.status(404).json({ message: 'Файл не найден' });
      return;
    }

    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/mp4'
      });
      fs.createReadStream(videoPath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4'
      });
      fs.createReadStream(videoPath).pipe(res);
    }
  } catch (error: any) {
    console.error('Ошибка в getFile:', error);
    res.status(404).json({ message: 'Файл не найден', error: error?.message || String(error) });
  }
};

// GET /api/videos/thumbnail/:id
export const getThumbnail: RequestHandler = async (req, res) => {
  try {
    ensureDirs();
    const id = req.params.id;
    if (/^https?:\/\//i.test(id)) {
      res.status(400).json({ message: 'Неверный идентификатор обложки' });
      return;
    }
    const thumbPath = path.join(thumbsDir, id);
    if (!fs.existsSync(thumbPath)) {
      res.status(404).json({ message: 'Обложка не найдена' });
      return;
    }
    res.set('Content-Type', 'image/jpeg');
    res.set('Content-Disposition', `inline; filename="${path.basename(thumbPath)}"`);
    fs.createReadStream(thumbPath).pipe(res);
  } catch (error: any) {
    console.error('Ошибка в getThumbnail:', error);
    res.status(404).json({ message: 'Обложка не найдена', error: error?.message || String(error) });
  }
};
