import assert from "node:assert/strict"
import { test } from "vitest"
import { songPresetToContiOverrides } from "./preset-overrides.ts"

const preset = {
  id: "preset-1",
  keys: JSON.stringify(["G", "A"]),
  tempos: JSON.stringify([72, 84]),
  sectionOrder: JSON.stringify(["Intro", "V", "C"]),
  lyrics: JSON.stringify([]),
  resolvedLyrics: ["line 1", "line 2"],
  sectionLyricsMap: JSON.stringify({ 0: [0], 2: [1] }),
  notes: "soft intro",
}

test("copies full preset arrangement data into conti overrides", () => {
  assert.deepEqual(songPresetToContiOverrides(preset, ["sheet-1", "sheet-2"]), {
    keys: ["G", "A"],
    tempos: [72, 84],
    sectionOrder: ["Intro", "V", "C"],
    lyrics: ["line 1", "line 2"],
    sectionLyricsMap: { 0: [0], 2: [1] },
    notes: "soft intro",
    sheetMusicFileIds: ["sheet-1", "sheet-2"],
    presetId: "preset-1",
  })
})

test("uses all sheet music semantics when a preset has no explicit sheet music", () => {
  assert.equal(songPresetToContiOverrides(preset, []).sheetMusicFileIds, null)
})

test("copies display-only mashup preset data without changing conti override shape", () => {
  const mashupPreset = {
    ...preset,
    presetType: "mashup",
    displayTitle: "A / B",
  }
  const overrides = songPresetToContiOverrides(mashupPreset, ["sheet-1"])

  assert.deepEqual(Object.keys(overrides).sort(), [
    "keys",
    "lyrics",
    "notes",
    "presetId",
    "sectionLyricsMap",
    "sectionOrder",
    "sheetMusicFileIds",
    "tempos",
  ].sort())
  assert.equal(overrides.presetId, "preset-1")
})
