import { NextRequest, NextResponse } from 'next/server';
import { connectDB, Alert, EventLog, Camera } from '@hostel-monitor/db';

const ML_API_KEY = process.env.ML_API_KEY || 'hms-ml-key-2026';

export async function POST(req: NextRequest) {
  try {
    // Simple API key auth
    const apiKey = req.headers.get('x-api-key') || req.headers.get('authorization')?.replace('Bearer ', '');
    if (apiKey !== ML_API_KEY) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    const body = await req.json();

    const {
      cameraId,
      type,
      class: detectedClass,
      confidence,
      boundingBox,
      zone,
      riskLevel,
      timestamp,
      frameSnapshot,
    } = body;

    // Map risk level to severity
    const severityMap: Record<string, string> = {
      RED: 'CRITICAL',
      YELLOW: 'HIGH',
      GREEN: 'LOW',
    };

    // Create Alert document
    const alert = await Alert.create({
      cameraId,
      type: type || 'ANIMAL_INTRUSION',
      severity: severityMap[riskLevel] || 'HIGH',
      description: `${detectedClass} detected${zone ? ` in ${zone}` : ''} (confidence: ${(confidence * 100).toFixed(1)}%)`,
      frameSnapshot,
      boundingBox,
      zone,
      detectedClass,
      confidence,
      read: false,
    });

    // Create EventLog entry
    await EventLog.create({
      cameraId,
      type: type || 'ANIMAL_INTRUSION',
      riskLevel: riskLevel || 'YELLOW',
      detectedClass: detectedClass || 'unknown',
      confidence: confidence || 0,
      zone,
      frameSnapshot,
      boundingBox,
    });

    return NextResponse.json({
      success: true,
      data: { alertId: alert.id },
    });
  } catch (error: any) {
    console.error('[api/alerts/ml] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal error' },
      { status: 500 }
    );
  }
}
