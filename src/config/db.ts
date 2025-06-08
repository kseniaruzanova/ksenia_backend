import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGO_URI;
    const dbName = process.env.DB_NAME;

    if (!mongoURI) {
      console.error('MONGO_URI is not defined in .env file');
      process.exit(1);
    }

    await mongoose.connect(mongoURI, {
      dbName: dbName || 'myAppDB',
    });

    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

export default connectDB; 