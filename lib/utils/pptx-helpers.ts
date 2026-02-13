import type { ContiSongWithSong, PptxExportSongData } from '@/lib/types';

/**
 * Build PPTX export song data from conti songs.
 * Section names are auto-generated: `${prefix} ${1-based index}`.
 * Only songs with sectionOrder configured are included.
 * Max 4 songs (matches typical worship setlist and PPT template sections).
 */
export function buildPptxSongData(
  songs: ContiSongWithSong[],
  prefix: string
): PptxExportSongData[] {
  return songs
    .filter((cs) => cs.overrides.sectionOrder.length > 0)
    .slice(0, 4)
    .map((cs, idx) => ({
      title: cs.song.name,
      section_name: `${prefix} ${idx + 1}`,
      section_order: cs.overrides.sectionOrder,
      lyrics: cs.overrides.lyrics,
      section_lyrics_map: Object.fromEntries(
        Object.entries(cs.overrides.sectionLyricsMap).map(
          ([k, v]) => [String(k), v]
        )
      ),
    }));
}
