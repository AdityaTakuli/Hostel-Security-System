import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { User, Hostel, Floor, Camera, Alert, Role, AlertType, Severity, connectDB } from './index';

dotenv.config();

const SEED_DATA = {
  hostels: [
    {
      _id: 'A',
      name: 'Alpha Block',
      floors: 15,
    },
    {
      _id: 'C',
      name: 'Beta Block',
      floors: 16,
    },
  ],
};

async function seed() {
  console.log('Connecting to database...');
  await connectDB();
  console.log('Connected.');

  console.log('Clearing existing data...');
  await Promise.all([
    User.deleteMany({}),
    Hostel.deleteMany({}),
    Floor.deleteMany({}),
    Camera.deleteMany({}),
    Alert.deleteMany({}),
  ]);

  console.log('Creating Admin User...');
  const hashedPassword = await bcrypt.hash('password123', 10);
  await User.create({
    name: 'System Admin',
    email: 'admin@hostel.com',
    password: hashedPassword,
    role: Role.SUPER_ADMIN,
  });

  console.log('Creating Hostels, Floors, and Cameras...');
  for (const hData of SEED_DATA.hostels) {
    const hostel = await Hostel.create({
      _id: hData._id,
      name: hData.name,
      floors: hData.floors,
    });

    for (let f = 1; f <= hData.floors; f++) {
      const floor = await Floor.create({
        hostelId: hostel._id,
        number: f,
      });

      // Create 2 cameras per floor
      for (let c = 1; c <= 2; c++) {
        const camera = await Camera.create({
          label: `Cam ${hData._id}-${f}0${c}`,
          floorId: floor._id,
          rtspUrl: `rtsp://mock-stream.local/${hData._id}/${f}/${c}`,
          posX: Math.floor(Math.random() * 80) + 10,
          posY: Math.floor(Math.random() * 80) + 10,
          isOnline: true,
        });

        // Add dummy alerts randomly
        if (Math.random() > 0.7) {
          await Alert.create({
            cameraId: camera._id,
            type: AlertType.UNAUTHORIZED_PERSON,
            severity: Severity.MEDIUM,
            description: 'Unknown person detected in corridor.',
            resolved: false,
          });
        }
      }
    }
  }

  console.log('Seed completed successfully.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
