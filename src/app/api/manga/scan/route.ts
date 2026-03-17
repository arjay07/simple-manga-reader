import { NextResponse } from 'next/server';
import { scanMangaDirectory } from '@/lib/scanner';

export async function POST() {
  try {
    const result = scanMangaDirectory();

    return NextResponse.json({
      success: true,
      seriesCount: result.seriesCount,
      volumeCount: result.volumeCount,
    });
  } catch (error) {
    console.error('Failed to scan manga directory:', error);
    return NextResponse.json(
      { error: 'Failed to scan manga directory' },
      { status: 500 }
    );
  }
}
