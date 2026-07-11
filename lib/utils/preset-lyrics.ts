import type {
  PresetLyricsSource,
  SongPresetWithSheetMusic,
} from "../types.ts"

type PresetLyricsInput = Pick<
  SongPresetWithSheetMusic,
  "presetType" | "lyrics" | "songLyrics" | "fallbackLyrics"
>

interface ResolvedPresetLyrics {
  lyrics: string[]
  source: PresetLyricsSource
}

function parseStoredLyrics(field: string | null): string[] {
  if (!field) return []

  try {
    const parsed = JSON.parse(field) as unknown
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : []
  } catch {
    return []
  }
}

export function resolvePresetLyrics(
  input: PresetLyricsInput,
): ResolvedPresetLyrics {
  const storedLyrics = parseStoredLyrics(input.lyrics)

  if (storedLyrics.length > 0) {
    return {
      lyrics: storedLyrics,
      source: input.presetType === "mashup"
        ? "mashup-snapshot"
        : "preset-override",
    }
  }

  if (input.presetType === "single" && input.songLyrics?.length) {
    return { lyrics: [...input.songLyrics], source: "song" }
  }

  if (input.presetType === "mashup" && input.fallbackLyrics?.length) {
    return { lyrics: [...input.fallbackLyrics], source: "mashup-fallback" }
  }

  return { lyrics: [], source: "empty" }
}
