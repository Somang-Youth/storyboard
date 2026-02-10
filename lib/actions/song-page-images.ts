'use server';

import { db } from '@/lib/db';
import { songPageImages } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { eq } from 'drizzle-orm';
import { put, del } from '@vercel/blob';
import type { ActionResult, SongPageImage } from '@/lib/types';

export async function saveSongPageImageFromForm(formData: FormData): Promise<ActionResult<SongPageImage>> {
  try {
    const file = formData.get('file') as File;
    const songId = formData.get('songId') as string;
    const contiId = formData.get('contiId') as string;
    const pageIndex = parseInt(formData.get('pageIndex') as string, 10);
    const sheetMusicFileId = (formData.get('sheetMusicFileId') as string) || null;
    const pdfPageIndex = formData.get('pdfPageIndex') as string;
    const presetSnapshot = formData.get('presetSnapshot') as string;

    if (!file || !songId || !contiId) {
      return { success: false, error: '필수 데이터가 누락되었습니다' };
    }

    const now = new Date();
    const id = generateId();

    const blob = await put(
      `song-pages/${songId}/${contiId}-p${pageIndex}.jpg`,
      file,
      { access: 'public' }
    );

    const record = {
      id,
      songId,
      contiId,
      imageUrl: blob.url,
      pageIndex,
      sheetMusicFileId,
      pdfPageIndex: pdfPageIndex ? parseInt(pdfPageIndex, 10) : null,
      presetSnapshot,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(songPageImages).values(record);
    return { success: true, data: record };
  } catch {
    return { success: false, error: '페이지 이미지 저장 중 오류가 발생했습니다' };
  }
}

export async function deletePageImagesForConti(contiId: string): Promise<ActionResult> {
  try {
    const existing = await db
      .select()
      .from(songPageImages)
      .where(eq(songPageImages.contiId, contiId));

    await Promise.allSettled(
      existing.map(img => del(img.imageUrl).catch(() => {}))
    );

    await db.delete(songPageImages).where(eq(songPageImages.contiId, contiId));
    return { success: true };
  } catch {
    return { success: false, error: '페이지 이미지 삭제 중 오류가 발생했습니다' };
  }
}

export async function getPageImagesForSong(songId: string): Promise<ActionResult<SongPageImage[]>> {
  try {
    const images = await db
      .select()
      .from(songPageImages)
      .where(eq(songPageImages.songId, songId))
      .orderBy(songPageImages.createdAt);
    return { success: true, data: images };
  } catch {
    return { success: false, error: '페이지 이미지를 불러올 수 없습니다' };
  }
}
