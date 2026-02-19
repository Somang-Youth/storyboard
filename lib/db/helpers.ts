export function parseJsonColumn<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function stringifyJsonColumn<T>(value: T): string {
  return JSON.stringify(value);
}

export function parseContiSongOverrides(raw: {
  keys: string | null;
  tempos: string | null;
  sectionOrder: string | null;
  lyrics: string | null;
  sectionLyricsMap: string | null;
  notes: string | null;
  sheetMusicFileIds?: string | null;
  presetId?: string | null;
}) {
  return {
    keys: parseJsonColumn<string[]>(raw.keys, []),
    tempos: parseJsonColumn<number[]>(raw.tempos, []),
    sectionOrder: parseJsonColumn<string[]>(raw.sectionOrder, []),
    lyrics: parseJsonColumn<string[]>(raw.lyrics, []),
    sectionLyricsMap: parseJsonColumn<Record<number, number[]>>(raw.sectionLyricsMap, {}),
    notes: raw.notes,
    sheetMusicFileIds: raw.sheetMusicFileIds ? parseJsonColumn<string[]>(raw.sheetMusicFileIds, []) : null,
    presetId: raw.presetId ?? null,
  };
}

export function stringifyContiSongOverrides(data: {
  keys?: string[];
  tempos?: number[];
  sectionOrder?: string[];
  lyrics?: string[];
  sectionLyricsMap?: Record<number, number[]>;
  notes?: string | null;
  sheetMusicFileIds?: string[] | null;
  presetId?: string | null;
}) {
  return {
    ...(data.keys !== undefined && { keys: stringifyJsonColumn(data.keys) }),
    ...(data.tempos !== undefined && { tempos: stringifyJsonColumn(data.tempos) }),
    ...(data.sectionOrder !== undefined && { sectionOrder: stringifyJsonColumn(data.sectionOrder) }),
    ...(data.lyrics !== undefined && { lyrics: stringifyJsonColumn(data.lyrics) }),
    ...(data.sectionLyricsMap !== undefined && { sectionLyricsMap: stringifyJsonColumn(data.sectionLyricsMap) }),
    ...(data.notes !== undefined && { notes: data.notes }),
    ...(data.sheetMusicFileIds !== undefined && {
      sheetMusicFileIds: data.sheetMusicFileIds ? stringifyJsonColumn(data.sheetMusicFileIds) : null
    }),
    ...(data.presetId !== undefined && { presetId: data.presetId }),
  };
}

export const parseSongPresetOverrides = parseContiSongOverrides;

export function parsePresetPdfMetadata<T>(value: string | null): T | null {
  return parseJsonColumn<T | null>(value, null);
}
