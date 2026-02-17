import { and, asc, eq, ilike, max } from 'drizzle-orm';
import { db } from '@/lib/db';
import { contiSongs, songs } from '@/lib/db/schema';
import { insertContiSong, insertSong } from '@/lib/db/insert-helpers';
import { mergeParsedWorshipData, parseDiscordMessages } from '@/lib/discord-parser';
import type { DiscordMessage } from '@/lib/discord-sync/discord-client';
import {
  attachContiToActiveThread,
  getProcessedMessageIds,
  markMessageProcessed,
  upsertContiByDate,
} from '@/lib/discord-sync/state-store';

function toISODateFromYYMMDD(value: string): string {
  const year = `20${value.slice(0, 2)}`;
  const month = value.slice(2, 4);
  const day = value.slice(4, 6);
  return `${year}-${month}-${day}`;
}

function buildContiDescription(sourceThreadId: string): string {
  return `discord-thread:${sourceThreadId}`;
}

async function findOrCreateSongId(songName: string): Promise<string> {
  const normalizedName = songName.trim();
  if (!normalizedName) {
    throw new Error('Song name is empty');
  }

  const existing = await db
    .select({ id: songs.id })
    .from(songs)
    .where(ilike(songs.name, normalizedName))
    .orderBy(asc(songs.createdAt))
    .limit(1);

  if (existing.length > 0) {
    return existing[0].id;
  }

  const created = await insertSong(db, normalizedName);
  return created.id;
}

async function addSongsToConti(contiId: string, songNames: string[]) {
  if (songNames.length === 0) {
    return;
  }

  const maxOrderResult = await db
    .select({ maxOrder: max(contiSongs.sortOrder) })
    .from(contiSongs)
    .where(eq(contiSongs.contiId, contiId));

  let nextSortOrder = (maxOrderResult[0]?.maxOrder ?? -1) + 1;

  for (const songName of songNames) {
    const songId = await findOrCreateSongId(songName);
    const existsInConti = await db
      .select({ id: contiSongs.id })
      .from(contiSongs)
      .where(and(eq(contiSongs.contiId, contiId), eq(contiSongs.songId, songId)))
      .limit(1);

    if (existsInConti.length > 0) {
      continue;
    }

    await insertContiSong(db, contiId, songId, nextSortOrder);
    nextSortOrder += 1;
  }
}

export async function processDiscordMessages(threadId: string, sundayDate: string, messages: DiscordMessage[]) {
  const processedIds = new Set(await getProcessedMessageIds(threadId));
  const unprocessed = messages.filter((message) => !processedIds.has(message.id));

  if (unprocessed.length === 0) {
    return { processedCount: 0, contiId: null as string | null };
  }

  const parsed = parseDiscordMessages(
    unprocessed.map((message) => ({
      id: message.id,
      content: message.content,
      timestamp: message.timestamp,
      author: {
        id: message.author.id,
        username: message.author.username,
        globalName: message.author.global_name,
      },
    }))
  );

  const merged = mergeParsedWorshipData(parsed);
  const contiDate = toISODateFromYYMMDD(sundayDate);
  const contiId = await upsertContiByDate(contiDate, merged.title ?? null, buildContiDescription(threadId));
  await attachContiToActiveThread(contiId);

  if (merged.songs && merged.songs.length > 0) {
    await addSongsToConti(contiId, merged.songs);
  }

  const parseStatus = Object.keys(merged).length > 0 ? 'parsed' : 'ignored';
  for (const message of unprocessed) {
    await markMessageProcessed(threadId, message.id, message.content, parseStatus);
  }

  return { processedCount: unprocessed.length, contiId };
}
