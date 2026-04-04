import { NextRequest, NextResponse } from 'next/server';
import { connectDB, Camera } from '@hostel-monitor/db';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();
    const body = await req.json();
    const { zones } = body;

    const camera = await Camera.findByIdAndUpdate(
      params.id,
      { $set: { restrictedZones: zones } },
      { new: true }
    );

    if (!camera) {
      return NextResponse.json({ success: false, error: 'Camera not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: camera });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();
    const camera = await Camera.findById(params.id);

    if (!camera) {
      return NextResponse.json({ success: false, error: 'Camera not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: camera.restrictedZones || [],
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
