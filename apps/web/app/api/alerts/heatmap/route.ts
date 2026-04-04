import { NextRequest, NextResponse } from 'next/server';
import { connectDB, EventLog } from '@hostel-monitor/db';

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const window = searchParams.get('window') || '24h';

    // Calculate time window
    const windowMs: Record<string, number> = {
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
    };

    const since = new Date(Date.now() - (windowMs[window] || windowMs['24h']));

    // Aggregate alert counts by cameraId
    const pipeline = [
      { $match: { timestamp: { $gte: since } } },
      {
        $group: {
          _id: '$cameraId',
          alertCount: { $sum: 1 },
          redCount: {
            $sum: { $cond: [{ $eq: ['$riskLevel', 'RED'] }, 1, 0] },
          },
          yellowCount: {
            $sum: { $cond: [{ $eq: ['$riskLevel', 'YELLOW'] }, 1, 0] },
          },
        },
      },
    ];

    const results = await EventLog.aggregate(pipeline);

    const heatmapData = results.map((r: any) => ({
      cameraId: r._id,
      alertCount: r.alertCount,
      redCount: r.redCount,
      yellowCount: r.yellowCount,
      riskLevel: r.alertCount > 5 ? 'RED' : r.alertCount > 0 ? 'YELLOW' : 'GREEN',
    }));

    return NextResponse.json({ success: true, data: heatmapData });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
