import type { ParsedDiscordMessage, ParsedWorshipData } from '@/lib/discord-parser/types';

export function hasParsedWorshipData(data?: ParsedWorshipData): boolean {
  if (!data) {
    return false;
  }

  if (data.title || data.scripture) {
    return true;
  }

  return Boolean(data.songs && data.songs.length > 0);
}

export function mergeParsedWorshipData(parsedMessages: ParsedDiscordMessage[]): ParsedWorshipData {
  const merged: ParsedWorshipData = {};

  for (const parsedMessage of parsedMessages) {
    const parsed = parsedMessage.parsedData;
    if (!hasParsedWorshipData(parsed) || !parsed) {
      continue;
    }

    if (parsed.title) {
      merged.title = parsed.title;
    }

    if (parsed.scripture) {
      merged.scripture = parsed.scripture;
    }

    if (parsed.songs && parsed.songs.length > 0) {
      merged.songs = parsed.songs;
    }
  }

  return merged;
}
