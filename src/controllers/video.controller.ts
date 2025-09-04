import { Request, RequestHandler, Response } from "express";
import mongoose from "mongoose";
import { Readable } from "stream";
import Video, { IVideo } from "../models/video.model";

// GridFS бакеты
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

function bufferToStream(buffer: Buffer): Readable {
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  return stream;
}

async function saveToGridFS(
  bucket: mongoose.mongo.GridFSBucket,
  file: { buffer?: Buffer; originalname: string; mimetype: string }
): Promise<mongoose.Types.ObjectId> {
  if (!file.buffer) throw new Error("Нет буфера для сохранения в GridFS");

  return new Promise<mongoose.Types.ObjectId>((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(file.originalname, {
      contentType: file.mimetype
    });

    uploadStream.on("error", (error) => {
      reject(error);
    });
    uploadStream.on("finish", () => {
      resolve(uploadStream.id);
    });

    const readableStream = new Readable();
    readableStream.push(file.buffer);
    readableStream.push(null);
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

// 📌 Получить все видео
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
    const { title, description, type, source: sourceLink } = req.body;

    let source: string | mongoose.Types.ObjectId | undefined;
    let thumbnail: mongoose.Types.ObjectId | string | undefined;

    // --- Видео ---
    if (type === "file" && req.files && "video" in req.files) {
      const videoFile = (req.files as any).video[0];
      console.log("Сохраняем видео:", videoFile.originalname);
      source = await saveToGridFS(videoBucket, videoFile);
      console.log("Видео успешно сохранено, _id:", source.toString());
    } else if (type === "link") {
      source = sourceLink;
    }

    // --- Thumbnail ---
    if (req.files && "thumbnail" in req.files) {
      const thumbFile = (req.files as any).thumbnail[0];

      if (thumbFile.buffer) {
        // сохраняем в GridFS
        console.log("Сохраняем thumbnail в GridFS:", thumbFile.originalname);
        thumbnail = await saveToGridFS(thumbnailBucket, thumbFile);
      } else if (thumbFile.originalname && thumbFile.originalname.startsWith("http")) {
        // сохраняем как ссылку
        console.log("Thumbnail пришёл как URL, сохраняем ссылку:", thumbFile.originalname);
        thumbnail = thumbFile.originalname;
      }
    }

    const video = new Video({ 
      title, 
      description, 
      type, 
      source, 
      thumbnail 
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

    const { title, description, type, source: sourceLink } = req.body;

    if (title) found.title = title;
    if (description) found.description = description;
    
    // Обновление типа и источника
    if (type && type !== found.type) {
      found.type = type;
      
      // Если меняем тип, нужно обработать старый источник
      if (found.type === "file" && typeof found.source === "string") {
        // Был link, стал file - удаляем старый источник (если нужно)
        found.source = sourceLink as any;
      } else if (found.type === "link" && found.source instanceof mongoose.Types.ObjectId) {
        // Был file, стал link - удаляем старый файл
        await deleteFromGridFS(videoBucket, found.source);
        found.source = sourceLink;
      }
    }

    // Обновление видео файла
    if (type === "file" && req.files && "video" in req.files) {
      // Удаляем старый файл
      if (found.source instanceof mongoose.Types.ObjectId) {
        await deleteFromGridFS(videoBucket, found.source);
      }
      
      const videoFile = (req.files as any).video[0];
      found.source = await saveToGridFS(videoBucket, videoFile);
    } else if (type === "link" && sourceLink) {
      // Удаляем старый файл если был
      if (found.source instanceof mongoose.Types.ObjectId) {
        await deleteFromGridFS(videoBucket, found.source);
      }
      found.source = sourceLink;
    }

    // Обновление thumbnail
    if (req.files && "thumbnail" in req.files) {
      const thumbFile = (req.files as any).thumbnail[0];
      
      // Удаляем старый thumbnail если он был файлом
      if (found.thumbnail instanceof mongoose.Types.ObjectId) {
        await deleteFromGridFS(thumbnailBucket, found.thumbnail);
      }
      
      if (thumbFile.buffer) {
        // Сохраняем новый файл
        found.thumbnail = await saveToGridFS(thumbnailBucket, thumbFile);
      } else if (thumbFile.originalname && thumbFile.originalname.startsWith("http")) {
        // Сохраняем как ссылку
        found.thumbnail = thumbFile.originalname;
      }
    }

    const updated = await found.save();
    res.status(200).json(updated);
  } catch (error: any) {
    console.error("Ошибка в updateVideo:", error);
    res.status(400).json({ message: "Ошибка при обновлении видео", error });
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

    const downloadStream = videoBucket.openDownloadStream(id);
    
    // Устанавливаем заголовки
    res.set("Content-Type", files[0].contentType || "application/octet-stream");
    res.set("Content-Disposition", `inline; filename="${files[0].filename}"`);
    
    downloadStream.on("error", (error: any) => {
      console.error("Ошибка при чтении файла:", error);
      res.status(404).json({ message: "Файл не найден" });
    });
    
    downloadStream.pipe(res);
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