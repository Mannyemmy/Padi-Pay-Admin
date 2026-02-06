import { NextRequest, NextResponse } from 'next/server';
import { activityLogger } from '@/lib/services/activityLogger';

export async function withApiLogging(
  req: NextRequest,
  next: () => Promise<NextResponse>,
  adminId?: string,
  adminEmail?: string,
  adminName?: string
) {
  const userAgent = req.headers.get('user-agent') || '';
  const ipAddress = req.headers.get('x-forwarded-for') || 
                   req.headers.get('x-real-ip') || 
                   'unknown';

  const startTime = Date.now();
  
  // Execute the request
  const response = await next();
  const endTime = Date.now();

  // Log the API call if admin info is available
  if (adminId && adminEmail && adminName) {
    await activityLogger.logApiCall(
      adminId,
      adminEmail,
      adminName,
      req.nextUrl.pathname,
      req.method,
      response.status,
      {
        requestBody: await getRequestBody(req),
        responseTime: endTime - startTime,
        queryParams: Object.fromEntries(req.nextUrl.searchParams)
      },
      userAgent,
      ipAddress
    );
  }

  return response;
}

async function getRequestBody(req: NextRequest): Promise<any> {
  try {
    // Don't log large files or sensitive data
    const contentType = req.headers.get('content-type');
    if (contentType?.includes('multipart/form-data') || 
        contentType?.includes('image') || 
        contentType?.includes('video')) {
      return { type: 'file_upload' };
    }

    if (req.body && contentType?.includes('application/json')) {
      const clonedReq = req.clone();
      const body = await clonedReq.json();
      
      // Remove sensitive fields
      const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization'];
      const sanitizedBody = { ...body };
      
      sensitiveFields.forEach(field => {
        if (sanitizedBody[field]) {
          sanitizedBody[field] = '***REDACTED***';
        }
      });

      return sanitizedBody;
    }

    return null;
  } catch {
    return null;
  }
}