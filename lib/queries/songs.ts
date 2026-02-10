import { db } from '@/lib/db';
import { songs, sheetMusicFiles, songPresets, presetSheetMusic } from '@/lib/db/schema';
import { eq, desc, ilike } from 'drizzle-orm';
import type { SongWithSheetMusic, SongPresetWithSheetMusic } from '@/lib/types';

export async function getSongs() {
  return await db.select().from(songs).orderBy(desc(songs.createdAt));
}

export async function getSong(id: string): Promise<SongWithSheetMusic | null> {
  const song = await db.select().from(songs).where(eq(songs.id, id)).limit(1);

  if (song.length === 0) {
    return null;
  }

  const sheetMusic = await db
    .select()
    .from(sheetMusicFiles)
    .where(eq(sheetMusicFiles.songId, id))
    .orderBy(sheetMusicFiles.sortOrder);

  const presets = await getSongPresets(id);

  return {
    ...song[0],
    sheetMusic,
    presets,
  };
}

export async function getSongPresets(songId: string) {
  return await db
    .select()
    .from(songPresets)
    .where(eq(songPresets.songId, songId))
    .orderBy(songPresets.sortOrder);
}

export async function searchSongs(query: string) {
  return await db
    .select()
    .from(songs)
    .where(ilike(songs.name, `%${query}%`))
    .orderBy(desc(songs.createdAt));
}

export async function getSongPresetsWithSheetMusic(songId: string): Promise<SongPresetWithSheetMusic[]> {
  const presets = await getSongPresets(songId);

  const presetsWithSheetMusic = await Promise.all(
    presets.map(async (preset) => {
      const sheetMusicRows = await db
        .select({ sheetMusicFileId: presetSheetMusic.sheetMusicFileId })
        .from(presetSheetMusic)
        .where(eq(presetSheetMusic.presetId, preset.id))
        .orderBy(presetSheetMusic.sortOrder);

      return {
        ...preset,
        sheetMusicFileIds: sheetMusicRows.map(r => r.sheetMusicFileId),
      };
    })
  );

  return presetsWithSheetMusic;
}
