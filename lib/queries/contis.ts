import { db } from '@/lib/db';
import { contis, contiSongs, songs } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { parseContiSongOverrides } from '@/lib/db/helpers';
import type { ContiWithSongs } from '@/lib/types';

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
    }),
  }));

  return {
    ...conti[0],
    songs: songsWithOverrides,
  };
}
