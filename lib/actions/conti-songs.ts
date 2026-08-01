'use server';

import { revalidatePath } from 'next/cache';
import type {
  ActionResult,
  ContiSong,
  ContiSongOverrides,
  PdfLayoutState,
} from '@/lib/types';
import { createSongPreset, updateSongPreset } from './song-presets';
import { z } from 'zod';
import { getStoryboardRepository } from '@/lib/repositories/storyboard';
import type { MashupContiSongOverrides } from '@/lib/repositories/storyboard/types';
import { invalidateConti, invalidateSong, invalidateSongs } from '@/lib/cache/invalidation';

export async function addSongToConti(
  contiId: string,
  songId: string,
  initialOverrides?: Partial<ContiSongOverrides>
): Promise<ActionResult<ContiSong>> {
  try {
    const contiSong = await getStoryboardRepository().addSongToConti(contiId, songId, initialOverrides);
    invalidateConti(contiId);
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
    const repository = getStoryboardRepository();
    const source = await repository.getContiSong(contiSongId);
    await repository.removeContiSong(contiSongId);
    if (source) {
      invalidateConti(source.contiId);
    }
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
    const repository = getStoryboardRepository();
    const source = await repository.getContiSong(contiSongId);
    await repository.updateContiSong(contiSongId, data);
    if (source) {
      invalidateConti(source.contiId);
    }
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
    await getStoryboardRepository().reorderContiSongs(contiId, orderedIds);
    invalidateConti(contiId);
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
  existingPresetId?: string,
  options: { youtubeReference?: string | null; youtubeTitle?: string | null } = {},
): Promise<ActionResult> {
  try {
    const source = await getStoryboardRepository().getContiSongPresetSource(contiSongId);

    if (!source) {
      return { success: false, error: '콘티 곡을 찾을 수 없습니다' };
    }

    let result;
    const youtubeReference = options.youtubeReference;
    const youtubePayload =
      youtubeReference !== undefined
        ? { youtubeReference, youtubeTitle: options.youtubeTitle ?? null }
        : {};

    if (existingPresetId) {
      result = await updateSongPreset(existingPresetId, {
        name: presetName,
        keys: source.overrides.keys,
        tempos: source.overrides.tempos,
        sectionOrder: source.overrides.sectionOrder,
        lyrics: source.overrides.lyrics,
        sectionLyricsMap: source.overrides.sectionLyricsMap,
        notes: source.overrides.notes,
        sheetMusicFileIds: source.overrides.sheetMusicFileIds ?? [],
        pdfMetadata: source.pdfMetadata,
        ...youtubePayload,
      });
    } else {
      result = await createSongPreset(source.songId, {
        name: presetName,
        keys: source.overrides.keys,
        tempos: source.overrides.tempos,
        sectionOrder: source.overrides.sectionOrder,
        lyrics: source.overrides.lyrics,
        sectionLyricsMap: source.overrides.sectionLyricsMap,
        notes: source.overrides.notes,
        sheetMusicFileIds: source.overrides.sheetMusicFileIds ?? [],
        pdfMetadata: source.pdfMetadata,
        isDefault: false,
        ...youtubePayload,
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

export async function syncPresetPdfMetadataFromContiLayout(
  contiId: string,
  layoutStateText: string,
): Promise<ActionResult<{ updatedPresetCount: number }>> {
  try {
    const parsed = JSON.parse(layoutStateText) as PdfLayoutState;
    const result = await getStoryboardRepository().syncPresetPdfMetadataFromContiLayout(contiId, parsed);
    invalidateConti(contiId);

    return {
      success: true,
      data: result,
    };
  } catch {
    return {
      success: false,
      error: '프리셋 PDF 메타데이터 동기화 중 오류가 발생했습니다',
    };
  }
}

const applyMashupSchema = z.object({
  contiId: z.string().min(1),
  firstContiSongId: z.string().min(1),
  secondContiSongId: z.string().min(1),
  presetId: z.string().min(1),
});

const splitMashupSchema = z.object({
  contiId: z.string().min(1),
  mashupGroupId: z.string().min(1),
  mode: z.enum(['restore', 'clear']),
});

export async function applyMashupToContiSongs(
  input: z.input<typeof applyMashupSchema>
): Promise<ActionResult<{ mashupGroupId: string }>> {
  try {
    const validation = applyMashupSchema.safeParse(input);
    if (!validation.success) return { success: false, error: '매시업 연결 정보가 올바르지 않습니다' };
    const result = await getStoryboardRepository().applyMashupToContiSongs(validation.data);
    invalidateConti(validation.data.contiId);
    revalidatePath('/contis');
    return { success: true, data: result };
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'MASHUP_REQUIRES_ADJACENT_ROWS') return { success: false, error: '인접한 두 곡만 매시업으로 연결할 수 있습니다' };
    if (message === 'MASHUP_ALREADY_GROUPED') return { success: false, error: '이미 매시업으로 연결된 곡입니다' };
    if (message === 'MASHUP_PRESET_SONGS_MISMATCH') return { success: false, error: '선택한 매시업 프리셋의 곡 순서가 현재 콘티와 맞지 않습니다' };
    return { success: false, error: '매시업 연결 중 오류가 발생했습니다' };
  }
}

export async function updateMashupContiSongs(input: {
  contiId: string;
  mashupGroupId: string;
  overrides: MashupContiSongOverrides;
}): Promise<ActionResult> {
  try {
    if (!input.contiId || !input.mashupGroupId) {
      return { success: false, error: '매시업 정보가 올바르지 않습니다' };
    }
    await getStoryboardRepository().updateMashupContiSongs(input);
    invalidateConti(input.contiId);
    revalidatePath('/contis');
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'MASHUP_GROUP_NOT_FOUND') {
      return { success: false, error: '매시업 그룹을 찾을 수 없습니다' };
    }
    return { success: false, error: '매시업 편집 저장 중 오류가 발생했습니다' };
  }
}

export async function splitMashup(input: z.input<typeof splitMashupSchema>): Promise<ActionResult> {
  try {
    const validation = splitMashupSchema.safeParse(input);
    if (!validation.success) return { success: false, error: '매시업 분리 정보가 올바르지 않습니다' };
    await getStoryboardRepository().splitMashup(validation.data);
    invalidateConti(validation.data.contiId);
    revalidatePath('/contis');
    return { success: true };
  } catch {
    return { success: false, error: '매시업 분리 중 오류가 발생했습니다' };
  }
}

const batchImportItemSchema = z.object({
  songId: z.string().nullable(),
  songName: z.string().nullable().optional().default(null),
  newSongName: z.string().nullable(),
  videoId: z.string().nullable().optional().default(null),
  title: z.string().nullable().optional().default(null),
  presetId: z.string().nullable().optional().default(null),
  createNewPreset: z.boolean().optional().default(false),
  presetName: z.string().nullable().optional().default(null),
  alreadyInConti: z.boolean().optional().default(false),
  replaceExistingYoutube: z.boolean().optional().default(true),
  mashupWithNext: z
    .object({
      presetId: z.string().nullable().optional().default(null),
      createNewPreset: z.boolean().optional().default(true),
      presetName: z.string().optional().default(''),
    })
    .nullable()
    .optional()
    .default(null),
})

const batchImportSchema = z.object({
  contiId: z.string().min(1),
  items: z.array(batchImportItemSchema).min(1, '가져올 곡이 없습니다'),
})

export async function batchImportSongsToConti(
  contiId: string,
  items: Array<{
    songId: string | null
    songName?: string | null
    newSongName: string | null
    videoId?: string | null
    title?: string | null
    presetId?: string | null
    createNewPreset?: boolean
    presetName?: string | null
    alreadyInConti?: boolean
    replaceExistingYoutube?: boolean
    mashupWithNext?: {
      presetId: string | null
      createNewPreset: boolean
      presetName: string
    } | null
  }>
): Promise<ActionResult<{ added: number; created: number; presetUpdated: number; mashupsApplied: number }>> {
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

    const result = await getStoryboardRepository().batchImportSongsToConti(contiId, validatedItems)

    invalidateConti(contiId)
    invalidateSongs()
    const existingSongIds = new Set(
      validatedItems
        .map((item) => item.songId)
        .filter((songId): songId is string => Boolean(songId))
    )
    for (const songId of existingSongIds) {
      invalidateSong(songId)
    }

    revalidatePath('/contis')
    revalidatePath('/songs')

    return {
      success: true,
      data: result,
    }
  } catch (error) {
    console.error('[batchImportSongsToConti]', error)
    const message = error instanceof Error ? error.message : ''
    if (message === 'PRESET_NOT_FOUND') {
      return { success: false, error: '선택한 프리셋을 찾을 수 없습니다' }
    }
    if (
      message.includes('conti_song_unique') ||
      message.includes('UNIQUE constraint failed: conti_songs.conti_id, conti_songs.song_id')
    ) {
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
