'use server';

import { db } from '@/lib/db';
import { contiSongs } from '@/lib/db/schema';
import { eq, max } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { stringifyContiSongOverrides, parseContiSongOverrides } from '@/lib/db/helpers';
import type { ActionResult, ContiSong, ContiSongOverrides } from '@/lib/types';
import { createSongPreset, updateSongPreset } from './song-presets';
import { insertContiSong, insertSong } from '@/lib/db/insert-helpers';
import { z } from 'zod';

export async function addSongToConti(
  contiId: string,
  songId: string,
  initialOverrides?: Partial<ContiSongOverrides>
): Promise<ActionResult<ContiSong>> {
  try {
    const maxSortOrderResult = await db
      .select({ maxOrder: max(contiSongs.sortOrder) })
      .from(contiSongs)
      .where(eq(contiSongs.contiId, contiId));

    const nextSortOrder = (maxSortOrderResult[0]?.maxOrder ?? -1) + 1;

    const contiSong = await insertContiSong(db, contiId, songId, nextSortOrder, initialOverrides);
    revalidatePath('/contis');

    return {
      success: true,
      data: contiSong,
    };
  } catch (error) {
    return {
      success: false,
      error: '콘티에 곡 추가 중 오류가 발생했습니다',
    };
  }
}

export async function removeSongFromConti(contiSongId: string): Promise<ActionResult> {
  try {
    await db.delete(contiSongs).where(eq(contiSongs.id, contiSongId));
    revalidatePath('/contis');

    return {
      success: true,
    };
  } catch (error) {
    return {
      success: false,
      error: '콘티에서 곡 제거 중 오류가 발생했습니다',
    };
  }
}

export async function updateContiSong(
  contiSongId: string,
  data: Partial<ContiSongOverrides>
): Promise<ActionResult> {
  try {
    const serialized = stringifyContiSongOverrides(data);
    const updatedData = {
      ...serialized,
      updatedAt: new Date(),
    };

    await db.update(contiSongs).set(updatedData).where(eq(contiSongs.id, contiSongId));
    revalidatePath('/contis');

    return {
      success: true,
    };
  } catch (error) {
    return {
      success: false,
      error: '콘티 곡 정보 수정 중 오류가 발생했습니다',
    };
  }
}

export async function reorderContiSongs(
  contiId: string,
  orderedIds: string[]
): Promise<ActionResult> {
  try {
    for (let i = 0; i < orderedIds.length; i++) {
      await db
        .update(contiSongs)
        .set({ sortOrder: i })
        .where(eq(contiSongs.id, orderedIds[i]));
    }

    revalidatePath('/contis');

    return {
      success: true,
    };
  } catch (error) {
    return {
      success: false,
      error: '콘티 곡 순서 변경 중 오류가 발생했습니다',
    };
  }
}

export async function saveContiSongAsPreset(
  contiSongId: string,
  presetName: string,
  existingPresetId?: string
): Promise<ActionResult> {
  try {
    const contiSongRow = await db
      .select()
      .from(contiSongs)
      .where(eq(contiSongs.id, contiSongId))
      .limit(1);

    if (contiSongRow.length === 0) {
      return { success: false, error: '콘티 곡을 찾을 수 없습니다' };
    }

    const cs = contiSongRow[0];
    const overrides = parseContiSongOverrides(cs);

    let result;
    if (existingPresetId) {
      result = await updateSongPreset(existingPresetId, {
        name: presetName,
        keys: overrides.keys,
        tempos: overrides.tempos,
        sectionOrder: overrides.sectionOrder,
        lyrics: overrides.lyrics,
        sectionLyricsMap: overrides.sectionLyricsMap,
        notes: overrides.notes,
        sheetMusicFileIds: overrides.sheetMusicFileIds ?? [],
      });
    } else {
      result = await createSongPreset(cs.songId, {
        name: presetName,
        keys: overrides.keys,
        tempos: overrides.tempos,
        sectionOrder: overrides.sectionOrder,
        lyrics: overrides.lyrics,
        sectionLyricsMap: overrides.sectionLyricsMap,
        notes: overrides.notes,
        sheetMusicFileIds: overrides.sheetMusicFileIds ?? [],
        isDefault: false,
      });
    }

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return { success: true };
  } catch {
    return { success: false, error: '프리셋 저장 중 오류가 발생했습니다' };
  }
}

const batchImportItemSchema = z.object({
  songId: z.string().nullable(),
  newSongName: z.string().nullable(),
})

const batchImportSchema = z.object({
  contiId: z.string().min(1),
  items: z.array(batchImportItemSchema).min(1, '가져올 곡이 없습니다'),
})

export async function batchImportSongsToConti(
  contiId: string,
  items: Array<{
    songId: string | null
    newSongName: string | null
  }>
): Promise<ActionResult<{ added: number; created: number }>> {
  try {
    const validation = batchImportSchema.safeParse({ contiId, items })
    if (!validation.success) {
      return { success: false, error: '가져올 곡 목록이 올바르지 않습니다' }
    }

    const validatedItems = validation.data.items

    // Manual refine check (Zod 4 .refine() inside .array() is unreliable)
    for (const item of validatedItems) {
      if (item.songId === null && (item.newSongName === null || item.newSongName.trim().length === 0)) {
        return { success: false, error: '곡 ID 또는 새 곡 이름이 필요합니다' }
      }
    }

    let created = 0

    const maxResult = await db
      .select({ maxOrder: max(contiSongs.sortOrder) })
      .from(contiSongs)
      .where(eq(contiSongs.contiId, contiId))

    let nextSortOrder = (maxResult[0]?.maxOrder ?? -1) + 1

    // Deduplicate new song names within the batch
    const newSongMap = new Map<string, string>() // normalized name -> created song ID

    for (const item of validatedItems) {
      let resolvedSongId: string

      if (item.songId) {
        resolvedSongId = item.songId
      } else {
        const trimmedName = item.newSongName!.trim()
        const normalizedKey = trimmedName.toLowerCase()

        if (newSongMap.has(normalizedKey)) {
          resolvedSongId = newSongMap.get(normalizedKey)!
        } else {
          const newSong = await insertSong(db, trimmedName)
          newSongMap.set(normalizedKey, newSong.id)
          resolvedSongId = newSong.id
          created++
        }
      }

      await insertContiSong(db, contiId, resolvedSongId, nextSortOrder++)
    }

    revalidatePath('/contis')
    revalidatePath('/songs')

    return {
      success: true,
      data: { added: items.length, created },
    }
  } catch (error) {
    console.error('[batchImportSongsToConti]', error)
    const message = error instanceof Error ? error.message : ''
    if (message.includes('conti_song_unique')) {
      return {
        success: false,
        error: '이미 콘티에 포함된 곡이 있습니다. 중복 곡을 제거하고 다시 시도해주세요',
      }
    }
    return {
      success: false,
      error: '곡 일괄 추가 중 오류가 발생했습니다',
    }
  }
}
