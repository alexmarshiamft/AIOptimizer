import { NextRequest, NextResponse } from 'next/server';
import { getScan } from '@/lib/database';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const scan = getScan(id);

    if (!scan) {
      return NextResponse.json({ error: 'Scan not found' }, { status: 404 });
    }

    return NextResponse.json(scan);
  } catch (error) {
    console.error('Get scan error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
