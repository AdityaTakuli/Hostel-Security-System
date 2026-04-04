import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { db } from '@hostel-monitor/db';

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
     await db.connectDB();
     const alert = await db.Alert.findById(params.id);
     if (!alert) return NextResponse.json({ error: 'Alert not found' }, { status: 404 });

     const updatedAlert = await db.Alert.findByIdAndUpdate(
         params.id,
         {
             resolved: true,
             resolvedBy: session.user?.name || session.user?.email || 'Unknown User',
             resolvedAt: new Date()
         },
         { new: true }
     );

     return NextResponse.json(updatedAlert);

  } catch (error) {
      console.error('Error resolving alert:', error);
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
