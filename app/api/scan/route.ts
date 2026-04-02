import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { createScan } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Validate URL format
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return NextResponse.json({ error: 'URL must use http or https protocol' }, { status: 400 });
    }

    const id = uuidv4();
    createScan(id, parsedUrl.href);

    return NextResponse.json({ id, url: parsedUrl.href });
  } catch (error) {
    console.error('Scan creation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
