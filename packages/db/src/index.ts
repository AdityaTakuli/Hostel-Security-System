import mongoose from 'mongoose';
import { User, Hostel, Floor, Camera, Alert, EventLog, Role, AlertType, Severity, AlarmMode } from './schema';

export * from './schema';

let cached = (global as any).mongoose;

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}

export async function connectDB() {
  const MONGODB_URI = process.env.MONGODB_URI;

  if (!MONGODB_URI) {
    throw new Error('Please define the MONGODB_URI environment variable inside .env');
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      return mongoose;
    });
  }
  
  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

// In Next.js App Router, we often prefer a singleton pattern for the db models
// Exporting the mapped "prisma" equivalent object allows us to gradually migrate API calls.
// We can expose an object called `db` that acts like the core service.
export const db = {
  User,
  Hostel,
  Floor,
  Camera,
  Alert,
  EventLog,
  connectDB
};

// Re-export as `prisma`? Since we removed Prisma, we MUST update all calls from `prisma.*` 
// to `db.*`, but wait, we can just export an object called `prisma` globally for smooth transition
// if we stub the methods. But Mongoose methods (.find, .findOne) are different from Prisma (.findMany, .findUnique).
// We will update the `apps/web` files to use `db.*` or the direct Models.
