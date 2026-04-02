/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';
import { db } from '@hostel-monitor/db';

export async function GET(
  request: Request,
  { params }: { params: { hostelId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { hostelId } = params;

  try {
    await db.connectDB();
    const hostel: any = await db.Hostel.findById(hostelId).populate({
        path: 'floorList',
        options: { sort: { number: 1 } },
        populate: {
            path: 'cameras',
            populate: {
                path: 'alerts',
                match: { resolved: false }
            }
        }
    });

    if (!hostel) {
       return NextResponse.json({ error: 'Hostel not found' }, { status: 404 });
    }

    const floors = (hostel.floorList || []).map((floor: any) => {
        const cameraCount = floor.cameras?.length || 0;
        let activeAlertCount = 0;
        
        (floor.cameras || []).forEach((cam: any) => {
            activeAlertCount += cam.alerts?.length || 0;
        });

        return {
            id: floor.id,
            number: floor.number,
            cameraCount,
            activeAlertCount
        }
    });

    return NextResponse.json({
        id: hostel.id,
        name: hostel.name,
        floors
    });
  } catch (error) {
    console.error(`Error fetching hostel ${hostelId}:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
