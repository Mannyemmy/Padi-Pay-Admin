import { NextRequest, NextResponse } from 'next/server';
import { activityLogger } from '@/lib/services/activityLogger';
import { getCurrentAdmin } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin();
    
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if admin has permission to view logs
    if (!admin.permissions?.['/login-logs']) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50');
    const startAfter = parseInt(searchParams.get('startAfter') || '0');
    const adminId = searchParams.get('adminId');

    let logs;
    if (adminId) {
      logs = await activityLogger.getAdminLogs(adminId, limit, startAfter || undefined);
    } else {
      logs = await activityLogger.getAllLogs(limit, startAfter || undefined);
    }

    return NextResponse.json({ logs });
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}