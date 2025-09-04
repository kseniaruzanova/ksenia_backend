import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { initGridFS } from "../controllers/video.controller";

dotenv.config();

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGO_URI;
    const dbName = process.env.DB_NAME;

    if (!mongoURI) {
      console.error('MONGO_URI is not defined');
      process.exit(1);
    }

    await mongoose.connect(mongoURI, { dbName: dbName || 'myAppDB' });

    // Ждём полной готовности connection
    await new Promise<void>((resolve) => {
      if (mongoose.connection.readyState === 1) {
        resolve();
      } else {
        mongoose.connection.once('open', resolve);
      }
    });

    // Теперь точно safe инициализировать GridFS
    initGridFS();
    console.log('✅ GridFS initialized and ready');

    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

export default connectDB;
