'use server';

import { db } from '@/lib/db';
import { contiSongs } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { eq, max } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { stringifyContiSongOverrides, parseContiSongOverrides } from '@/lib/db/helpers';
import type { ActionResult, ContiSong, ContiSongOverrides } from '@/lib/types';
import { createSongPreset, updateSongPreset } from './song-presets';

export async function addSongToConti(
  contiId: string,
  songId: string,
  initialOverrides?: Partial<ContiSongOverrides>
): Promise<ActionResult<ContiSong>> {
  try {
    // Get next sort order
    const maxSortOrderResult = await db
      .select({ maxOrder: max(contiSongs.sortOrder) })
      .from(contiSongs)
      .where(eq(contiSongs.contiId, contiId));

    const nextSortOrder = (maxSortOrderResult[0]?.maxOrder ?? -1) + 1;

    const now = new Date();

    const overrides = initialOverrides
      ? stringifyContiSongOverrides(initialOverrides)
      : {
          keys: '[]',
          tempos: '[]',
          sectionOrder: '[]',
          lyrics: '[]',
          sectionLyricsMap: '{}',
        };

    const contiSong = {
      id: generateId(),
      contiId,
      songId,
      sortOrder: nextSortOrder,
      keys: overrides.keys ?? '[]',
      tempos: overrides.tempos ?? '[]',
      sectionOrder: overrides.sectionOrder ?? '[]',
      lyrics: overrides.lyrics ?? '[]',
      sectionLyricsMap: overrides.sectionLyricsMap ?? '{}',
      notes: initialOverrides?.notes ?? null,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(contiSongs).values(contiSong);
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
