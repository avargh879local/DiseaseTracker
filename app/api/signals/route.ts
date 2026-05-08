import { NextResponse } from 'next/server';
import { fetchAllSignals } from '@/lib/signals';

export const revalidate = 300;

export async function GET() {
  try {
    const data = await fetchAllSignals();
    return NextResponse.json(data);
  } catch (e) {
    console.error('[SENTINEL] API route error:', e);
    return NextResponse.json({ error: 'Failed to fetch signals' }, { status: 500 });
  }
}
