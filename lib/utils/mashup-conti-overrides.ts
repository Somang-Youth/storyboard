import type { ArrangementDraft } from "@/components/shared/arrangement-editor/types";
import type { MashupContiSongOverrides } from "@/lib/repositories/storyboard/types";

/**
 * Builds the arrangement overrides written to BOTH conti songs of a mashup
 * group when editing the mashup from the conti screen.
 *
 * `presetId` is intentionally excluded so both rows keep pointing at the shared
 * mashup preset and the group stays valid. An empty explicit sheet-music
 * selection collapses to `null` ("use all") to match conti export semantics.
 */
export function draftToMashupContiSongOverrides(
  draft: ArrangementDraft,
): MashupContiSongOverrides {
  return {
    keys: draft.keys,
    tempos: draft.tempos,
    sectionOrder: draft.sectionOrder,
    lyrics: draft.lyrics,
    sectionLyricsMap: draft.sectionLyricsMap,
    notes: draft.notes,
    sheetMusicFileIds:
      draft.sheetMusicFileIds && draft.sheetMusicFileIds.length > 0
        ? draft.sheetMusicFileIds
        : null,
  };
}
