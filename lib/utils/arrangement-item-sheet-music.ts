import type { SheetMusicFile } from "@/lib/types";

/**
 * Combines the sheet music of every conti song in an arrangement item,
 * de-duplicated by file id with order preserved.
 *
 * A mashup item spans two conti songs, so the PDF export must include both
 * member songs' sheets — not just the primary (front) song's. Single items have
 * one song, so this is a no-op passthrough for them.
 */
export function combineArrangementItemSheetMusic(
  songs: readonly { sheetMusic: SheetMusicFile[] }[],
): SheetMusicFile[] {
  const seen = new Set<string>();
  const combined: SheetMusicFile[] = [];

  for (const song of songs) {
    for (const file of song.sheetMusic) {
      if (seen.has(file.id)) continue;
      seen.add(file.id);
      combined.push(file);
    }
  }

  return combined;
}
