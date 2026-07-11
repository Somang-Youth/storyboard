import type { ArrangementDraft } from "../../components/shared/arrangement-editor/types.ts"
import type {
  PresetPdfMetadata,
  ResolvedSongPresetWithSheetMusic,
  SongPresetData,
} from "../types.ts"
import { normalizeYouTubeReference, toYouTubeInputValue } from "./youtube.ts"

function parseJsonField<T>(field: string | null, fallback: T): T {
  if (!field) return fallback
  try {
    return JSON.parse(field) as T
  } catch {
    return fallback
  }
}

export function songPresetToDraft(
  preset: ResolvedSongPresetWithSheetMusic | undefined,
): ArrangementDraft {
  return {
    name: preset?.name ?? "",
    displayTitle: preset?.displayTitle ?? null,
    keys: parseJsonField<string[]>(preset?.keys ?? null, []),
    tempos: parseJsonField<number[]>(preset?.tempos ?? null, []),
    sectionOrder: parseJsonField<string[]>(preset?.sectionOrder ?? null, []),
    lyrics: preset?.resolvedLyrics ? [...preset.resolvedLyrics] : [],
    sectionLyricsMap: parseJsonField<Record<number, number[]>>(preset?.sectionLyricsMap ?? null, {}),
    notes: preset?.notes ?? null,
    sheetMusicFileIds: preset?.sheetMusicFileIds?.length ? preset.sheetMusicFileIds : null,
    pdfMetadata: parseJsonField<PresetPdfMetadata | null>(preset?.pdfMetadata ?? null, null),
    youtubeReference: toYouTubeInputValue(preset?.youtubeReference),
    youtubeTitle: preset?.youtubeTitle ?? null,
    isDefault: preset?.isDefault ?? false,
    appliedPresetId: preset?.id ?? null,
  }
}

export function arrangementDraftToSongPresetData(draft: ArrangementDraft): SongPresetData {
  const normalized = draft.youtubeReference
    ? normalizeYouTubeReference(draft.youtubeReference)
    : null

  return {
    name: draft.name.trim(),
    displayTitle: draft.displayTitle?.trim() || null,
    keys: draft.keys,
    tempos: draft.tempos,
    sectionOrder: draft.sectionOrder,
    lyrics: draft.lyrics,
    sectionLyricsMap: draft.sectionLyricsMap,
    notes: draft.notes?.trim() || null,
    isDefault: draft.isDefault,
    youtubeReference: normalized?.videoId ?? null,
    youtubeTitle: normalized ? draft.youtubeTitle : null,
    sheetMusicFileIds: draft.sheetMusicFileIds ?? [],
    pdfMetadata: draft.pdfMetadata,
  }
}
