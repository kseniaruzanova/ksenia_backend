import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Создаем директории для uploads если их нет
const uploadsDir = path.join(process.cwd(), 'uploads');
const imagesDir = path.join(uploadsDir, 'images');
const audioDir = path.join(uploadsDir, 'audio');
const videosDir = path.join(uploadsDir, 'videos');

[uploadsDir, imagesDir, audioDir, videosDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Настройка хранилища для изображений
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, imagesDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `image-${uniqueSuffix}${ext}`);
  }
});

// Настройка хранилища для аудио
const audioStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, audioDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `audio-${uniqueSuffix}${ext}`);
  }
});

// Фильтр для изображений
const imageFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Только изображения разрешены (JPEG, PNG, GIF, WEBP)'));
  }
};

// Фильтр для аудио
const audioFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = /mp3|wav|ogg|m4a/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = file.mimetype.startsWith('audio/');

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Только аудио файлы разрешены (MP3, WAV, OGG, M4A)'));
  }
};

// Middleware для загрузки изображений
export const uploadImages = multer({
  storage: imageStorage,
  fileFilter: imageFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  }
}).array('images', 10); // До 10 изображений

// Middleware для загрузки аудио
export const uploadAudio = multer({
  storage: audioStorage,
  fileFilter: audioFilter,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB
  }
}).single('audio');

export { uploadsDir, imagesDir, audioDir, videosDir };

