import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'unknown';
    
    return NextResponse.json({ ip });
  } catch (error) {
    return NextResponse.json({ ip: 'unknown' });
  }
}