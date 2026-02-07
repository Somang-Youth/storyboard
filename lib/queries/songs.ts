import { db } from '@/lib/db';
import { songs, sheetMusicFiles } from '@/lib/db/schema';
import { eq, desc, like } from 'drizzle-orm';
import type { SongWithSheetMusic } from '@/lib/types';

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

  return {
    ...song[0],
    sheetMusic,
  };
}

export async function searchSongs(query: string) {
  return await db
    .select()
    .from(songs)
    .where(like(songs.name, `%${query}%`))
    .orderBy(desc(songs.createdAt));
}
