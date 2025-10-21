import { Request, RequestHandler, Response } from "express";
import mongoose from "mongoose";
import { Readable } from "stream";
import Video from "../models/video.model";

let videoBucket: mongoose.mongo.GridFSBucket;
let thumbnailBucket: mongoose.mongo.GridFSBucket;

export const initGridFS = () => {
  const connection = mongoose.connection;
  if (!connection.db) {
    throw new Error("MongoDB connection not established");
  }
  videoBucket = new mongoose.mongo.GridFSBucket(connection.db, {
    bucketName: "videos"
  });
  thumbnailBucket = new mongoose.mongo.GridFSBucket(connection.db, {
    bucketName: "thumbnails"
  });
};

export const getGridFSBuckets = () => ({ videoBucket, thumbnailBucket });

// Middleware для отслеживания прогресса загрузки
export const uploadProgressMiddleware: RequestHandler = (req, res, next) => {
  const contentLength = parseInt(req.headers['content-length'] || '0');
  
  // Если content-length не указан или равен 0, пропускаем отслеживание
  if (contentLength <= 0) {
    return next();
  }
  
  let uploadedBytes = 0;
  
  req.on('data', (chunk: Buffer) => {
    uploadedBytes += chunk.length;
    const progress = Math.min((uploadedBytes / contentLength) * 100, 100);
    
    // Сохраняем прогресс в request object
    req.uploadProgress = progress;
    
    console.log(`Upload progress: ${progress.toFixed(2)}%`);
  });
  
  req.on('end', () => {
    req.uploadProgress = 100;
    console.log('Upload completed');
  });
  
  req.on('error', (error) => {
    console.error('Upload error:', error);
    req.uploadProgress = -1; // Ошибка
  });
  
  next();
};

async function saveToGridFSWithProgress(
  bucket: mongoose.mongo.GridFSBucket,
  file: { buffer?: Buffer; originalname: string; mimetype: string; size: number },
  onProgress?: (progress: number) => void
): Promise<mongoose.Types.ObjectId> {
  if (!file.buffer) throw new Error("Нет буфера для сохранения в GridFS");

  return new Promise<mongoose.Types.ObjectId>((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(file.originalname, {
      contentType: file.mimetype
    });

    let uploadedBytes = 0;
    
    uploadStream.on("error", (error) => {
      reject(error);
    });
    
    uploadStream.on("finish", () => {
      resolve(uploadStream.id);
    });

    const readableStream = new Readable();
    readableStream.push(file.buffer);
    readableStream.push(null);
    
    // Мониторим прогресс загрузки
    readableStream.on('data', (chunk) => {
      uploadedBytes += chunk.length;
      if (onProgress) {
        onProgress((uploadedBytes / file.size) * 100);
      }
    });
    
    readableStream.pipe(uploadStream);
  });
}

async function deleteFromGridFS(
  bucket: mongoose.mongo.GridFSBucket,
  fileId: mongoose.Types.ObjectId
): Promise<void> {
  try {
    await bucket.delete(fileId);
    console.log(`Файл ${fileId} успешно удален`);
  } catch (error: any) {
    // Игнорируем ошибки если файл не найден
    if (error.message && (error.message.includes("FileNotFound") || error.message.includes("file not found"))) {
      console.log(`Файл ${fileId} не найден, пропускаем удаление`);
    } else {
      console.error(`Ошибка при удалении файла ${fileId}:`, error);
      // Все равно разрешаем промис, чтобы не ломать основной flow
    }
  }
}

// 📌 Получить все видео (с опциональной фильтрацией по плейлисту)
export const getVideos: RequestHandler = async (_req, res) => {
  try {
    const videos = await Video.find().sort({ createdAt: -1 });
    res.status(200).json(videos);
  } catch (error: any) {
    res.status(500).json({ message: "Ошибка при получении видео", error });
  }
};

// POST /api/videos
export const createVideo: RequestHandler = async (req, res) => {
  try {
    const { title, description, type, source: sourceLink, playlistId, order } = req.body;

    let source: string | mongoose.Types.ObjectId | undefined;
    let thumbnail: mongoose.Types.ObjectId | string | undefined;

    // Функция для отслеживания прогресса
    const onVideoProgress = (progress: number) => {
      // Можно отправлять прогресс через WebSocket или сохранять в сессии
      console.log(`Video upload progress: ${progress.toFixed(2)}%`);
      // Для реального приложения нужно реализовать механизм отправки прогресса клиенту
    };

    const onThumbnailProgress = (progress: number) => {
      console.log(`Thumbnail upload progress: ${progress.toFixed(2)}%`);
    };

    // --- Видео ---
    if (type === "file" && req.files && "video" in req.files) {
      const videoFile = (req.files as any).video[0];
      console.log("Сохраняем видео:", videoFile.originalname);
      source = await saveToGridFSWithProgress(videoBucket, videoFile, onVideoProgress);
      console.log("Видео успешно сохранено, _id:", source.toString());
    } else if (type === "link") {
      source = sourceLink;
    }

    // --- Thumbnail ---
    if (req.files && "thumbnail" in req.files) {
      const thumbFile = (req.files as any).thumbnail[0];

      if (thumbFile.buffer) {
        console.log("Сохраняем thumbnail в GridFS:", thumbFile.originalname);
        thumbnail = await saveToGridFSWithProgress(thumbnailBucket, thumbFile, onThumbnailProgress);
      } else if (thumbFile.originalname && thumbFile.originalname.startsWith("http")) {
        console.log("Thumbnail пришёл как URL, сохраняем ссылку:", thumbFile.originalname);
        thumbnail = thumbFile.originalname;
      }
    }

    const video = new Video({ 
      title, 
      description, 
      type, 
      source, 
      thumbnail,
      playlistId: playlistId || null,
      order: order || 0
    });
    
    const savedVideo = await video.save();

    console.log("Видео сохранено в БД:", (savedVideo as any)._id.toString());
    res.status(201).json(savedVideo);
  } catch (error: any) {
    console.error("Ошибка в createVideo:", error);
    res.status(400).json({ message: "Ошибка при создании видео", error });
  }
};

// PUT /api/videos/:id
export const updateVideo: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const found = await Video.findById(id);
    if (!found) {
      res.status(404).json({ message: "Видео не найдено" });
      return;
    }

    const { title, description, type, source: sourceLink, playlistId, order } = req.body;

    if (title) found.title = title;
    if (description !== undefined) found.description = description;
    if (playlistId !== undefined) found.playlistId = playlistId || null;
    if (order !== undefined) found.order = order;
    
    // Функции для отслеживания прогресса
    const onVideoProgress = (progress: number) => {
      console.log(`Video upload progress: ${progress.toFixed(2)}%`);
      // Здесь можно добавить отправку прогресса через WebSocket
    };

    const onThumbnailProgress = (progress: number) => {
      console.log(`Thumbnail upload progress: ${progress.toFixed(2)}%`);
    };

    // Обновление типа и источника
    if (type && type !== found.type) {
      found.type = type;
      
      // Если меняем тип, нужно обработать старый источник
      if (found.type === "file" && typeof found.source === "string") {
        // Был link, стал file
        found.source = sourceLink as any;
      } else if (found.type === "link" && found.source instanceof mongoose.Types.ObjectId) {
        // Был file, стал link - удаляем старый файл
        await deleteFromGridFS(videoBucket, found.source);
        found.source = sourceLink;
      }
    }

    // Обновление видео файла
    if (req.files && "video" in req.files) {
      const videoFile = (req.files as any).video[0];
      
      // Валидация видео файла
      if (!videoFile.mimetype.startsWith('video/')) {
        res.status(400).json({ message: "Загруженный файл не является видео" });
        return;
      }

      // Удаляем старый файл
      if (found.source instanceof mongoose.Types.ObjectId) {
        await deleteFromGridFS(videoBucket, found.source);
      }
      
      // Сохраняем новый файл с отслеживанием прогресса
      found.source = await saveToGridFSWithProgress(videoBucket, videoFile, onVideoProgress);
      found.type = "file"; // Принудительно устанавливаем тип file при загрузке видео
    } else if (type === "link" && sourceLink) {
      // Удаляем старый файл если был
      if (found.source instanceof mongoose.Types.ObjectId) {
        await deleteFromGridFS(videoBucket, found.source);
      }
      found.source = sourceLink;
      found.type = "link";
    }

    // Обновление thumbnail
    if (req.files && "thumbnail" in req.files) {
      const thumbFile = (req.files as any).thumbnail[0];
      
      // Валидация изображения
      if (!thumbFile.mimetype.startsWith('image/') && !thumbFile.originalname.startsWith("http")) {
        res.status(400).json({ message: "Загруженный файл не является изображением" });
        return;
      }

      // Удаляем старый thumbnail если он был файлом
      if (found.thumbnail instanceof mongoose.Types.ObjectId) {
        await deleteFromGridFS(thumbnailBucket, found.thumbnail);
      }
      
      if (thumbFile.buffer) {
        // Сохраняем новый файл с отслеживанием прогресса
        found.thumbnail = await saveToGridFSWithProgress(thumbnailBucket, thumbFile, onThumbnailProgress);
      } else if (thumbFile.originalname && thumbFile.originalname.startsWith("http")) {
        // Сохраняем как ссылку
        found.thumbnail = thumbFile.originalname;
      } else if (thumbFile.buffer) {
        // Для buffer файлов без HTTP ссылки
        found.thumbnail = await saveToGridFSWithProgress(thumbnailBucket, thumbFile, onThumbnailProgress);
      }
    }

    // Проверяем, что источник установлен корректно
    if (!found.source) {
      res.status(400).json({ message: "Источник видео обязателен" });
      return;
    }

    const updated = await found.save();
    
    // Отправляем обновленное видео с populate если нужно
    const populatedVideo = await Video.findById(updated._id);
    
    res.status(200).json({
      message: "Видео успешно обновлено",
      video: populatedVideo
    });
    
  } catch (error: any) {
    console.error("Ошибка в updateVideo:", error);
    
    // Более детальная обработка ошибок
    if (error.name === 'ValidationError') {
      res.status(400).json({ 
        message: "Ошибка валидации данных", 
        errors: error.errors 
      });
    } else if (error.name === 'CastError') {
      res.status(400).json({ 
        message: "Неверный формат ID видео" 
      });
    } else {
      res.status(500).json({ 
        message: "Ошибка при обновлении видео", 
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
};

// DELETE /api/videos/:id
export const deleteVideo: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const found = await Video.findById(id);
    if (!found) {
      res.status(404).json({ message: "Видео не найдено" });
      return;
    }

    // Удаляем видео файл
    if (found.type === "file" && found.source instanceof mongoose.Types.ObjectId) {
      await deleteFromGridFS(videoBucket, found.source);
    }

    // Удаляем thumbnail файл
    if (found.thumbnail instanceof mongoose.Types.ObjectId) {
      await deleteFromGridFS(thumbnailBucket, found.thumbnail);
    }

    await found.deleteOne();
    res.status(200).json({ message: "Видео удалено" });
  } catch (error: any) {
    console.error("Ошибка в deleteVideo:", error);
    res.status(500).json({ message: "Ошибка при удалении видео", error });
  }
};

// GET /api/videos/file/:id
export const getFile: RequestHandler = async (req, res) => {
  try {
    const id = new mongoose.Types.ObjectId(req.params.id);
    
    // Проверяем существует ли файл
    const files = await videoBucket.find({ _id: id }).toArray();
    if (files.length === 0) {
      res.status(404).json({ message: "Файл не найден" });
      return;
    }

    const file = files[0];
    const fileSize = file.length;
    
    // Поддержка диапазонов для потокового воспроизведения
    const range = req.headers.range;
    
    if (range) {
      // Обработка запроса с диапазоном
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': file.contentType || 'video/mp4',
      };
      
      res.writeHead(206, head);
      
      const downloadStream = videoBucket.openDownloadStream(id, {
        start,
        end: end + 1
      });
      
      downloadStream.pipe(res);
    } else {
      // Полный файл
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': file.contentType || 'video/mp4',
      });
      
      const downloadStream = videoBucket.openDownloadStream(id);
      downloadStream.pipe(res);
    }
    
  } catch (error: any) {
    console.error("Ошибка в getFile:", error);
    res.status(404).json({ message: "Файл не найден", error });
  }
};

// GET /api/videos/thumbnail/:id
export const getThumbnail: RequestHandler = async (req, res) => {
  try {
    const id = new mongoose.Types.ObjectId(req.params.id);
    
    // Проверяем существует ли файл
    const files = await thumbnailBucket.find({ _id: id }).toArray();
    if (files.length === 0) {
      res.status(404).json({ message: "Обложка не найдена" });
      return;
    }

    const downloadStream = thumbnailBucket.openDownloadStream(id);
    
    // Устанавливаем заголовки
    res.set("Content-Type", files[0].contentType || "image/jpeg");
    res.set("Content-Disposition", `inline; filename="${files[0].filename}"`);
    
    downloadStream.on("error", (error: any) => {
      console.error("Ошибка при чтении обложки:", error);
      res.status(404).json({ message: "Обложка не найдена" });
    });
    
    downloadStream.pipe(res);
  } catch (error: any) {
    console.error("Ошибка в getThumbnail:", error);
    res.status(404).json({ message: "Обложка не найдена", error });
  }
};
