import { NextRequest, NextResponse } from 'next/server';
import { connectDB, Camera } from '@hostel-monitor/db';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();
    const body = await req.json();
    const { alarmMode } = body;

    if (!['always_on', 'user_choice', 'always_off'].includes(alarmMode)) {
      return NextResponse.json({ success: false, error: 'Invalid alarm mode' }, { status: 400 });
    }

    const camera = await Camera.findByIdAndUpdate(
      params.id,
      { $set: { alarmMode } },
      { new: true }
    );

    if (!camera) {
      return NextResponse.json({ success: false, error: 'Camera not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: { alarmMode: camera.alarmMode } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
