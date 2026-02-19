'use server';

import { db } from '@/lib/db';
import { songPresets, presetSheetMusic } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { ActionResult, SongPreset, SongPresetData, SongPresetWithSheetMusic } from '@/lib/types';
import { getSongPresets, getSongPresetsWithSheetMusic } from '@/lib/queries/songs';

const presetSchema = z.object({
  name: z.string().min(1, '프리셋 이름을 입력해주세요'),
  keys: z.array(z.string()).optional().default([]),
  tempos: z.array(z.number()).optional().default([]),
  sectionOrder: z.array(z.string()).optional().default([]),
  lyrics: z.array(z.string()).optional().default([]),
  sectionLyricsMap: z.record(z.string(), z.array(z.number())).optional().default({}),
  notes: z.string().nullable().optional().default(null),
  isDefault: z.boolean().optional().default(false),
  youtubeReference: z.string().nullable().optional().default(null),
  sheetMusicFileIds: z.array(z.string()).optional().default([]),
  pdfMetadata: z.unknown().nullable().optional().default(null),
});

export async function createSongPreset(songId: string, data: SongPresetData): Promise<ActionResult<SongPreset>> {
  try {
    const validation = presetSchema.safeParse(data);
    if (!validation.success) {
      return { success: false, error: validation.error.issues[0].message };
    }

    const d = validation.data;

    // If this is set as default, unset others
    if (d.isDefault) {
      await db.update(songPresets).set({ isDefault: false }).where(eq(songPresets.songId, songId));
    }

    // Calculate next sort order
    const existing = await getSongPresets(songId);
    const maxSort = existing.length > 0 ? Math.max(...existing.map(p => p.sortOrder)) : -1;

    const now = new Date();
    const presetRecord = {
      id: generateId(),
      songId,
      name: d.name,
      keys: JSON.stringify(d.keys),
      tempos: JSON.stringify(d.tempos),
      sectionOrder: JSON.stringify(d.sectionOrder),
      lyrics: JSON.stringify(d.lyrics),
      sectionLyricsMap: JSON.stringify(d.sectionLyricsMap),
      notes: d.notes,
      youtubeReference: d.youtubeReference ?? null,
      pdfMetadata: d.pdfMetadata ? JSON.stringify(d.pdfMetadata) : null,
      isDefault: d.isDefault,
      sortOrder: maxSort + 1,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(songPresets).values(presetRecord);

    // Insert sheet music associations
    if (d.sheetMusicFileIds && d.sheetMusicFileIds.length > 0) {
      await db.insert(presetSheetMusic).values(
        d.sheetMusicFileIds.map((fileId, index) => ({
          id: generateId(),
          presetId: presetRecord.id,
          sheetMusicFileId: fileId,
          sortOrder: index,
        }))
      );
    }

    const preset = presetRecord;

    revalidatePath(`/songs/${songId}`);
    return { success: true, data: preset as SongPreset };
  } catch {
    return { success: false, error: '프리셋 생성 중 오류가 발생했습니다' };
  }
}

export async function updateSongPreset(presetId: string, data: Partial<SongPresetData>): Promise<ActionResult<SongPreset>> {
  try {
    // Get existing preset to know songId
    const existing = await db.select().from(songPresets).where(eq(songPresets.id, presetId)).limit(1);
    if (existing.length === 0) {
      return { success: false, error: '프리셋을 찾을 수 없습니다' };
    }
    const songId = existing[0].songId;

    // If setting as default, unset others
    if (data.isDefault) {
      await db.update(songPresets).set({ isDefault: false }).where(eq(songPresets.songId, songId));
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.keys !== undefined) updateData.keys = JSON.stringify(data.keys);
    if (data.tempos !== undefined) updateData.tempos = JSON.stringify(data.tempos);
    if (data.sectionOrder !== undefined) updateData.sectionOrder = JSON.stringify(data.sectionOrder);
    if (data.lyrics !== undefined) updateData.lyrics = JSON.stringify(data.lyrics);
    if (data.sectionLyricsMap !== undefined) updateData.sectionLyricsMap = JSON.stringify(data.sectionLyricsMap);
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.isDefault !== undefined) updateData.isDefault = data.isDefault;
    if (data.youtubeReference !== undefined) updateData.youtubeReference = data.youtubeReference;
    if (data.pdfMetadata !== undefined) updateData.pdfMetadata = data.pdfMetadata ? JSON.stringify(data.pdfMetadata) : null;

    await db.update(songPresets).set(updateData).where(eq(songPresets.id, presetId));

    // Replace sheet music associations if provided
    if (data.sheetMusicFileIds !== undefined) {
      await db.delete(presetSheetMusic).where(eq(presetSheetMusic.presetId, presetId));
      if (data.sheetMusicFileIds && data.sheetMusicFileIds.length > 0) {
        await db.insert(presetSheetMusic).values(
          data.sheetMusicFileIds.map((fileId, index) => ({
            id: generateId(),
            presetId,
            sheetMusicFileId: fileId,
            sortOrder: index,
          }))
        );
      }
    }

    revalidatePath(`/songs/${songId}`);
    const result = await db.select().from(songPresets).where(eq(songPresets.id, presetId)).limit(1);
    return { success: true, data: result[0] };
  } catch {
    return { success: false, error: '프리셋 수정 중 오류가 발생했습니다' };
  }
}

export async function deleteSongPreset(presetId: string): Promise<ActionResult> {
  try {
    const existing = await db.select().from(songPresets).where(eq(songPresets.id, presetId)).limit(1);
    if (existing.length === 0) {
      return { success: false, error: '프리셋을 찾을 수 없습니다' };
    }

    await db.delete(songPresets).where(eq(songPresets.id, presetId));
    revalidatePath(`/songs/${existing[0].songId}`);
    return { success: true };
  } catch {
    return { success: false, error: '프리셋 삭제 중 오류가 발생했습니다' };
  }
}

export async function setDefaultPreset(songId: string, presetId: string): Promise<ActionResult> {
  try {
    // Unset all defaults for this song
    await db.update(songPresets).set({ isDefault: false }).where(eq(songPresets.songId, songId));
    // Set the selected one as default
    await db.update(songPresets).set({ isDefault: true, updatedAt: new Date() }).where(eq(songPresets.id, presetId));
    revalidatePath(`/songs/${songId}`);
    return { success: true };
  } catch {
    return { success: false, error: '기본 프리셋 설정 중 오류가 발생했습니다' };
  }
}

// Server action wrapper for lazy loading presets in client components
export async function getPresetsForSong(songId: string): Promise<ActionResult<SongPreset[]>> {
  try {
    const presets = await getSongPresets(songId);
    return { success: true, data: presets };
  } catch {
    return { success: false, error: '프리셋을 불러올 수 없습니다' };
  }
}

export async function getPresetSheetMusicFileIds(presetId: string): Promise<string[]> {
  const rows = await db
    .select({ sheetMusicFileId: presetSheetMusic.sheetMusicFileId })
    .from(presetSheetMusic)
    .where(eq(presetSheetMusic.presetId, presetId))
    .orderBy(presetSheetMusic.sortOrder);
  return rows.map(r => r.sheetMusicFileId);
}

export async function getPresetsForSongWithSheetMusic(songId: string): Promise<ActionResult<SongPresetWithSheetMusic[]>> {
  try {
    const presets = await getSongPresetsWithSheetMusic(songId);
    return { success: true, data: presets };
  } catch {
    return { success: false, error: '프리셋을 불러올 수 없습니다' };
  }
}
