import { NextRequest, NextResponse } from 'next/server';
import { connectDB, Alert } from '@hostel-monitor/db';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();

    const alert = await Alert.findByIdAndUpdate(
      params.id,
      { $set: { read: true } },
      { new: true }
    );

    if (!alert) {
      return NextResponse.json({ success: false, error: 'Alert not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: { id: alert.id, read: alert.read } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
