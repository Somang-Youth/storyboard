import { normalizeScripture } from '@/lib/discord-parser/scripture';
import type { DiscordParserMessage, ParsedDiscordMessage, ParsedWorshipData } from '@/lib/discord-parser/types';

const KEY_MAP: Record<string, keyof ParsedWorshipData> = {
  본문: 'scripture',
  말씀: 'scripture',
  제목: 'title',
  찬양: 'songs',
};

function parseSongs(rawValue: string): string[] {
  let songs: string[] = [];

  if (/\d+\.\s+/.test(rawValue)) {
    songs = rawValue
      .split(/\s*\d+\.\s*/)
      .map((song) => song.trim())
      .filter(Boolean);
  } else if (rawValue.includes('-')) {
    songs = rawValue.split('-').map((song) => song.trim()).filter(Boolean);
  } else if (rawValue.includes('/')) {
    songs = rawValue.split('/').map((song) => song.trim()).filter(Boolean);
  } else if (rawValue.includes(',')) {
    songs = rawValue.split(',').map((song) => song.trim()).filter(Boolean);
  } else {
    songs = [rawValue.trim()].filter(Boolean);
  }

  return songs.slice(0, 4);
}

export function extractWorshipData(content: string): ParsedWorshipData | undefined {
  const data: ParsedWorshipData = {};
  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const match = line.match(/^(.+?)\s*[:：]\s*(.+)$/);
    if (!match) {
      continue;
    }

    const rawKey = match[1].replace(/\s+/g, '');
    const rawValue = match[2].trim();
    const mappedKey = KEY_MAP[rawKey];
    if (!mappedKey) {
      continue;
    }

    if (mappedKey === 'songs') {
      const songs = parseSongs(rawValue);
      if (songs.length > 0) {
        data.songs = songs;
      }
      continue;
    }

    if (mappedKey === 'scripture') {
      data.scripture = normalizeScripture(rawValue);
      continue;
    }

    data[mappedKey] = rawValue;
  }

  return Object.keys(data).length > 0 ? data : undefined;
}

export function parseDiscordMessage(message: DiscordParserMessage): ParsedDiscordMessage {
  const parsedData = extractWorshipData(message.content);

  return {
    messageId: message.id,
    authorId: message.author?.id,
    authorName: message.author?.globalName ?? message.author?.username,
    content: message.content,
    timestamp: message.timestamp,
    parsedData,
  };
}

export function parseDiscordMessages(messages: DiscordParserMessage[]): ParsedDiscordMessage[] {
  return messages.map(parseDiscordMessage);
}
