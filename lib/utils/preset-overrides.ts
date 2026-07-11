import type {
  ContiSongOverrides,
  ResolvedSongPresetWithSheetMusic,
} from "../types"

type PresetArrangementSource = Pick<
  ResolvedSongPresetWithSheetMusic,
  | "id"
  | "keys"
  | "tempos"
  | "sectionOrder"
  | "resolvedLyrics"
  | "sectionLyricsMap"
  | "notes"
>

function parseJsonField<T>(field: string | null, fallback: T): T {
  if (!field) return fallback
  try {
    return JSON.parse(field) as T
  } catch {
    return fallback
  }
}

export function songPresetToContiOverrides(
  preset: PresetArrangementSource,
  sheetMusicFileIds: string[] = [],
): ContiSongOverrides {
  return {
    keys: parseJsonField<string[]>(preset.keys, []),
    tempos: parseJsonField<number[]>(preset.tempos, []),
    sectionOrder: parseJsonField<string[]>(preset.sectionOrder, []),
    lyrics: [...preset.resolvedLyrics],
    sectionLyricsMap: parseJsonField<Record<number, number[]>>(
      preset.sectionLyricsMap,
      {},
    ),
    notes: preset.notes,
    sheetMusicFileIds: sheetMusicFileIds.length > 0 ? sheetMusicFileIds : null,
    presetId: preset.id,
  }
}
