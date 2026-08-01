import assert from "node:assert/strict"
import { test } from "vitest"
import type { ArrangementDraft } from "@/components/shared/arrangement-editor/types"
import { draftToMashupContiSongOverrides } from "./mashup-conti-overrides.ts"

const baseDraft: ArrangementDraft = {
  name: "A / B",
  displayTitle: null,
  keys: ["G"],
  tempos: [72],
  sectionOrder: ["V", "C"],
  lyrics: ["l1", "l2"],
  sectionLyricsMap: { 0: [0], 1: [1] },
  notes: "n",
  sheetMusicFileIds: ["s1", "s2"],
  pdfMetadata: null,
  youtubeReference: null,
  youtubeTitle: null,
  isDefault: false,
  appliedPresetId: "mashup-preset-1",
}

test("omits presetId so the shared mashup preset stays applied to both rows", () => {
  const overrides = draftToMashupContiSongOverrides(baseDraft)
  assert.equal("presetId" in overrides, false)
})

test("carries the combined arrangement fields", () => {
  assert.deepEqual(draftToMashupContiSongOverrides(baseDraft), {
    keys: ["G"],
    tempos: [72],
    sectionOrder: ["V", "C"],
    lyrics: ["l1", "l2"],
    sectionLyricsMap: { 0: [0], 1: [1] },
    notes: "n",
    sheetMusicFileIds: ["s1", "s2"],
  })
})

test("collapses an empty sheet-music selection to null (use all)", () => {
  assert.equal(
    draftToMashupContiSongOverrides({ ...baseDraft, sheetMusicFileIds: [] }).sheetMusicFileIds,
    null,
  )
})

test("keeps a null sheet-music selection as null", () => {
  assert.equal(
    draftToMashupContiSongOverrides({ ...baseDraft, sheetMusicFileIds: null }).sheetMusicFileIds,
    null,
  )
})
