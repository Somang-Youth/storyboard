'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { ActionResult, ResolvedSongPresetWithSheetMusic, SongPreset, SongPresetData } from '@/lib/types';
import { invalidateSongPresets } from '@/lib/cache/invalidation';
import { getSongPresets, getSongPresetsWithSheetMusic } from '@/lib/queries/songs';
import { resolveYouTubeReferenceMetadata } from '@/lib/actions/youtube-metadata';
import { getStoryboardRepository } from '@/lib/repositories/storyboard';
import { isUniqueConstraintError } from '@/lib/utils/db-errors';
import { getDefaultPresetValidationError } from '@/lib/utils/song-preset-defaults';

const presetSchema = z.object({
  name: z.string().min(1, '프리셋 이름을 입력해주세요'),
  displayTitle: z.string().nullable().optional().default(null),
  keys: z.array(z.string()).optional().default([]),
  tempos: z.array(z.number()).optional().default([]),
  sectionOrder: z.array(z.string()).optional().default([]),
  lyrics: z.array(z.string()).optional().default([]),
  sectionLyricsMap: z.record(z.string(), z.array(z.number())).optional().default({}),
  notes: z.string().nullable().optional().default(null),
  isDefault: z.boolean().optional().default(false),
  youtubeReference: z.string().nullable().optional().default(null),
  youtubeTitle: z.string().nullable().optional().default(null),
  sheetMusicFileIds: z.array(z.string()).optional().default([]),
  pdfMetadata: z.unknown().nullable().optional().default(null),
});

const createMashupPresetSchema = z.object({
  songIds: z.tuple([z.string().min(1), z.string().min(1)]),
  data: presetSchema,
});

const lyricsSaveScopeSchema = z.object({
  lyricsSaveScope: z.enum(['song', 'preset']).optional(),
}).optional();

async function getPresetSongIds(presetId: string, fallbackSongId?: string): Promise<string[]> {
  const members = await getStoryboardRepository().getPresetMembers(presetId);
  const memberSongIds = members.map((member) => member.songId);
  return Array.from(new Set(memberSongIds.length > 0 ? memberSongIds : fallbackSongId ? [fallbackSongId] : []));
}

function invalidatePresetSongIds(songIds: readonly string[]) {
  for (const songId of new Set(songIds)) {
    invalidateSongPresets(songId);
    revalidatePath(`/songs/${songId}`);
  }
}

export async function createSongPreset(songId: string, data: SongPresetData): Promise<ActionResult<SongPreset>> {
  try {
    const validation = presetSchema.safeParse(data);
    if (!validation.success) {
      return { success: false, error: validation.error.issues[0].message };
    }

    const d = validation.data as SongPresetData;
    const resolvedYoutube = await resolveYouTubeReferenceMetadata(d.youtubeReference, d.youtubeTitle);

    const preset = await getStoryboardRepository().createSongPreset(songId, d, resolvedYoutube);

    invalidateSongPresets(songId);
    revalidatePath(`/songs/${songId}`);
    return { success: true, data: preset };
  } catch {
    return { success: false, error: '프리셋 생성 중 오류가 발생했습니다' };
  }
}

export async function findMashupPresetBySongs(
  firstSongId: string,
  secondSongId: string,
): Promise<ActionResult<ResolvedSongPresetWithSheetMusic | null>> {
  try {
    const preset = await getStoryboardRepository().findMashupPresetBySongs([firstSongId, secondSongId]);
    return { success: true, data: preset };
  } catch {
    return { success: false, error: '매시업 프리셋을 찾을 수 없습니다' };
  }
}

export async function createMashupPreset(
  songIds: [string, string],
  data: SongPresetData,
): Promise<ActionResult<ResolvedSongPresetWithSheetMusic>> {
  try {
    const validation = createMashupPresetSchema.safeParse({ songIds, data });
    if (!validation.success) {
      return { success: false, error: validation.error.issues[0].message };
    }

    const existing = await getStoryboardRepository().findMashupPresetBySongs(validation.data.songIds);
    if (existing) {
      invalidatePresetSongIds(validation.data.songIds);
      return { success: true, data: existing };
    }

    const d = validation.data.data as SongPresetData;
    const resolvedYoutube = await resolveYouTubeReferenceMetadata(d.youtubeReference, d.youtubeTitle);
    let preset;
    try {
      preset = await getStoryboardRepository().createMashupPreset(
        { songIds: validation.data.songIds, data: d },
        resolvedYoutube,
      );
    } catch (error) {
      if (isUniqueConstraintError(error, 'song_presets_mashup_pair_key_unique', { columns: ['mashup_pair_key'] })) {
        const existingAfterRace = await getStoryboardRepository().findMashupPresetBySongs(validation.data.songIds);
        if (existingAfterRace) {
          invalidatePresetSongIds(validation.data.songIds);
          return { success: true, data: existingAfterRace };
        }
      }
      throw error;
    }

    const presetWithSheetMusic = await getStoryboardRepository().getSongPresetWithSheetMusic(preset.id);

    invalidatePresetSongIds(validation.data.songIds);

    if (!presetWithSheetMusic) {
      return { success: false, error: '매시업 프리셋을 불러올 수 없습니다' };
    }

    return { success: true, data: presetWithSheetMusic };
  } catch {
    return { success: false, error: '매시업 프리셋 생성 중 오류가 발생했습니다' };
  }
}

export async function updateSongPreset(
  presetId: string,
  data: Partial<SongPresetData>,
  options?: { lyricsSaveScope?: 'song' | 'preset' },
): Promise<ActionResult<SongPreset>> {
  try {
    const optionValidation = lyricsSaveScopeSchema.safeParse(options);
    if (!optionValidation.success) {
      return { success: false, error: optionValidation.error.issues[0].message };
    }

    const existingPreset = await getStoryboardRepository().getSongPresetWithSheetMusic(presetId);
    if (!existingPreset) {
      return { success: false, error: '프리셋을 찾을 수 없습니다' };
    }
    if (data.isDefault && existingPreset.presetType === 'mashup') {
      return { success: false, error: '매시업 프리셋은 기본 프리셋으로 설정할 수 없습니다' };
    }

    const beforeSongIds = Array.from(
      new Set(
        existingPreset.members.length > 0
          ? existingPreset.members.map((member) => member.songId)
          : [existingPreset.songId],
      ),
    );
    const resolvedYoutube =
      data.youtubeReference !== undefined
        ? await resolveYouTubeReferenceMetadata(data.youtubeReference, data.youtubeTitle)
        : undefined;

    const updatedPreset = await getStoryboardRepository().updateSongPreset(
      presetId,
      data,
      resolvedYoutube,
      optionValidation.data,
    );
    if (!updatedPreset) {
      return { success: false, error: '프리셋을 찾을 수 없습니다' };
    }

    const afterSongIds = await getPresetSongIds(presetId, updatedPreset.songId);
    invalidatePresetSongIds([...beforeSongIds, ...afterSongIds]);
    return { success: true, data: updatedPreset };
  } catch {
    return { success: false, error: '프리셋 수정 중 오류가 발생했습니다' };
  }
}

export async function deleteSongPreset(presetId: string): Promise<ActionResult> {
  try {
    const songIds = await getPresetSongIds(presetId);
    const existing = await getStoryboardRepository().deleteSongPreset(presetId);
    if (!existing) {
      return { success: false, error: '프리셋을 찾을 수 없습니다' };
    }

    invalidatePresetSongIds(songIds.length > 0 ? songIds : [existing.songId]);
    return { success: true };
  } catch {
    return { success: false, error: '프리셋 삭제 중 오류가 발생했습니다' };
  }
}

export async function setDefaultPreset(songId: string, presetId: string): Promise<ActionResult> {
  try {
    const preset = await getStoryboardRepository().getSongPresetWithSheetMusic(presetId);
    const validationError = getDefaultPresetValidationError(preset, songId);
    if (validationError) {
      return { success: false, error: validationError };
    }

    await getStoryboardRepository().setDefaultPreset(songId, presetId);
    invalidateSongPresets(songId);
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
  return await getStoryboardRepository().getPresetSheetMusicFileIds(presetId);
}

export async function getPresetsForSongWithSheetMusic(songId: string): Promise<ActionResult<ResolvedSongPresetWithSheetMusic[]>> {
  try {
    const presets = await getSongPresetsWithSheetMusic(songId);
    return { success: true, data: presets };
  } catch {
    return { success: false, error: '프리셋을 불러올 수 없습니다' };
  }
}

export async function getSongPresetWithSheetMusic(presetId: string): Promise<ActionResult<ResolvedSongPresetWithSheetMusic>> {
  try {
    const preset = await getStoryboardRepository().getSongPresetWithSheetMusic(presetId);
    if (!preset) {
      return { success: false, error: '프리셋을 찾을 수 없습니다' };
    }

    return {
      success: true,
      data: preset,
    };
  } catch {
    return { success: false, error: '프리셋을 불러올 수 없습니다' };
  }
}
