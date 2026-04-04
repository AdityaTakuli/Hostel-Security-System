import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';
import { db } from '@hostel-monitor/db';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await db.connectDB();
    const camera = await db.Camera.findById(params.id);

    if (!camera) {
        return NextResponse.json({ error: 'Camera not found' }, { status: 404 });
    }

    const alerts = await db.Alert.find({ cameraId: params.id })
        .sort({ createdAt: -1 })
        .limit(20);

    return NextResponse.json({ ...camera.toJSON(), alerts });

  } catch (error) {
    console.error(`Error fetching camera:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  // @ts-ignore
  if (!session || session.user?.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized or Forbidden' }, { status: 403 });
  }

  try {
     const body = await request.json();
     const { posX, posY, description, rtspUrl } = body;

     const updateData: any = {};
     if (typeof posX === 'number') updateData.posX = posX;
     if (typeof posY === 'number') updateData.posY = posY;
     if (typeof description === 'string') updateData.description = description;
     if (typeof rtspUrl === 'string') updateData.rtspUrl = rtspUrl;

     await db.connectDB();
     const updatedCamera = await db.Camera.findByIdAndUpdate(
         params.id,
         updateData,
         { new: true }
     );

     return NextResponse.json(updatedCamera);

  } catch (error) {
      console.error('Error updating camera:', error);
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
