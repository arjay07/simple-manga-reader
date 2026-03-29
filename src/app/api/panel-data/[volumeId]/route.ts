import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getPanelDataForVolume, getPanelDataStatus, deletePanelDataForVolume } from '@/lib/panel-data';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ volumeId: string }> }
) {
  const { volumeId } = await params;
  const vid = Number(volumeId);

  const db = getDb();
  const volume = db.prepare('SELECT id FROM volumes WHERE id = ?').get(vid);
  if (!volume) {
    return NextResponse.json({ error: 'Volume not found' }, { status: 404 });
  }

  const pages = getPanelDataForVolume(vid);
  const status = getPanelDataStatus(vid);

  return NextResponse.json({ pages, ...status });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ volumeId: string }> }
) {
  const { volumeId } = await params;
  const vid = Number(volumeId);

  const deleted = deletePanelDataForVolume(vid);
  return NextResponse.json({ deleted });
}
