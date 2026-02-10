import { db } from '@/lib/db';
import { contis, contiSongs, songs, sheetMusicFiles, contiPdfExports } from '@/lib/db/schema';
import { eq, desc, inArray } from 'drizzle-orm';
import { parseContiSongOverrides } from '@/lib/db/helpers';
import type { ContiWithSongs, ContiWithSongsAndSheetMusic, ContiPdfExport } from '@/lib/types';

export async function getContis() {
  return await db.select().from(contis).orderBy(desc(contis.date));
}

export async function getConti(id: string): Promise<ContiWithSongs | null> {
  const conti = await db.select().from(contis).where(eq(contis.id, id)).limit(1);

  if (conti.length === 0) {
    return null;
  }

  const contiSongsData = await db
    .select()
    .from(contiSongs)
    .leftJoin(songs, eq(contiSongs.songId, songs.id))
    .where(eq(contiSongs.contiId, id))
    .orderBy(contiSongs.sortOrder);

  const songsWithOverrides = contiSongsData.map((row) => ({
    ...row.conti_songs,
    song: row.songs!,
    overrides: parseContiSongOverrides({
      keys: row.conti_songs.keys,
      tempos: row.conti_songs.tempos,
      sectionOrder: row.conti_songs.sectionOrder,
      lyrics: row.conti_songs.lyrics,
      sectionLyricsMap: row.conti_songs.sectionLyricsMap,
      notes: row.conti_songs.notes,
      sheetMusicFileIds: row.conti_songs.sheetMusicFileIds,
    }),
  }));

  return {
    ...conti[0],
    songs: songsWithOverrides,
  };
}

export async function getContiForExport(id: string): Promise<ContiWithSongsAndSheetMusic | null> {
  const conti = await getConti(id);
  if (!conti) return null;

  const songsWithSheetMusic = await Promise.all(
    conti.songs.map(async (contiSong) => {
      const selectedIds = contiSong.overrides.sheetMusicFileIds;

      let sheetMusic;
      if (selectedIds && selectedIds.length > 0) {
        // Use selected sheet music only, preserving selection order
        sheetMusic = await db
          .select()
          .from(sheetMusicFiles)
          .where(inArray(sheetMusicFiles.id, selectedIds));
        // Sort by the order in selectedIds
        const idOrder = new Map(selectedIds.map((smId, i) => [smId, i]));
        sheetMusic.sort((a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0));
      } else {
        // Fallback: all sheet music for the song
        sheetMusic = await db
          .select()
          .from(sheetMusicFiles)
          .where(eq(sheetMusicFiles.songId, contiSong.songId))
          .orderBy(sheetMusicFiles.sortOrder);
      }

      return { ...contiSong, sheetMusic };
    })
  );

  return { ...conti, songs: songsWithSheetMusic };
}

export async function getContiPdfExport(contiId: string): Promise<ContiPdfExport | null> {
  const result = await db
    .select()
    .from(contiPdfExports)
    .where(eq(contiPdfExports.contiId, contiId))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}
