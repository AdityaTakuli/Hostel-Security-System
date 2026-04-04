import { NextRequest, NextResponse } from 'next/server';
import { connectDB, Alert } from '@hostel-monitor/db';

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const type = searchParams.get('type');
    const severity = searchParams.get('severity');
    const cameraId = searchParams.get('cameraId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build filter object
    const filter: any = {};
    if (type) filter.type = type;
    if (severity) filter.severity = severity;
    if (cameraId) filter.cameraId = cameraId;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const total = await Alert.countDocuments(filter);
    const alerts = await Alert.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('camera');

    return NextResponse.json({
      success: true,
      data: {
        alerts,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
