import type { PgDatabase } from 'drizzle-orm/pg-core'
import type { NeonHttpQueryResultHKT } from 'drizzle-orm/neon-http'
import type * as schema from '@/lib/db/schema'
import { songs, contiSongs } from '@/lib/db/schema'
import { generateId } from '@/lib/id'
import { stringifyContiSongOverrides } from '@/lib/db/helpers'
import type { ContiSongOverrides } from '@/lib/types'

// Shared type that accepts both `db` and transaction `tx` handles.
// NeonHttpDatabase extends PgDatabase, and PgTransaction also extends PgDatabase,
// so this is the correct shared base class.
export type TxOrDb = PgDatabase<NeonHttpQueryResultHKT, typeof schema>

/** Insert a song within a transaction (or standalone). No revalidation. */
export async function insertSong(tx: TxOrDb, name: string) {
  const now = new Date()
  const song = {
    id: generateId(),
    name,
    createdAt: now,
    updatedAt: now,
  }
  await tx.insert(songs).values(song)
  return song
}

/** Insert a conti_song junction row within a transaction. No revalidation. */
export async function insertContiSong(
  tx: TxOrDb,
  contiId: string,
  songId: string,
  sortOrder: number,
  overrides?: Partial<ContiSongOverrides>
) {
  const now = new Date()
  const serialized = overrides
    ? stringifyContiSongOverrides(overrides)
    : { keys: '[]', tempos: '[]', sectionOrder: '[]', lyrics: '[]', sectionLyricsMap: '{}' }

  const contiSong = {
    id: generateId(),
    contiId,
    songId,
    sortOrder,
    keys: serialized.keys ?? '[]',
    tempos: serialized.tempos ?? '[]',
    sectionOrder: serialized.sectionOrder ?? '[]',
    lyrics: serialized.lyrics ?? '[]',
    sectionLyricsMap: serialized.sectionLyricsMap ?? '{}',
    notes: overrides?.notes ?? null,
    sheetMusicFileIds: serialized.sheetMusicFileIds ?? null,
    createdAt: now,
    updatedAt: now,
  }
  await tx.insert(contiSongs).values(contiSong)
  return contiSong
}
