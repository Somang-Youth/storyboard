import assert from "node:assert/strict"
import { test } from "vitest"
import type { ResolvedSongPresetWithSheetMusic } from "../types.ts"
import {
  arrangementDraftToSongPresetData,
  songPresetToDraft,
} from "./song-preset-draft.ts"

const preset: ResolvedSongPresetWithSheetMusic = {
  id: "preset-1",
  songId: "song-1",
  presetType: "mashup",
  displayTitle: "초대 + 부르심",
  mashupPairKey: "song-1→song-2",
  name: "2026-03-08",
  keys: JSON.stringify(["G", "A"]),
  tempos: JSON.stringify([72, 84]),
  sectionOrder: JSON.stringify(["Intro", "V", "C"]),
  lyrics: JSON.stringify(["line 1", "line 2"]),
  sectionLyricsMap: JSON.stringify({ 0: [0], 2: [1] }),
  notes: "soft intro",
  youtubeReference: "W1uussHIX9o",
  youtubeTitle: "Invitation",
  pdfMetadata: JSON.stringify({
    files: [
      {
        sheetMusicFileId: "sheet-1",
        pages: [{ pdfPageIndex: 0, overlays: [] }],
      },
    ],
  }),
  isDefault: true,
  sortOrder: 0,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  sheetMusicFileIds: ["sheet-1"],
  members: [
    {
      id: "member-1",
      presetId: "preset-1",
      songId: "song-1",
      sortOrder: 0,
      partLabel: null,
      songName: "초대",
    },
    {
      id: "member-2",
      presetId: "preset-1",
      songId: "song-2",
      sortOrder: 1,
      partLabel: null,
      songName: "부르심",
    },
  ],
  resolvedLyrics: ["line 1", "line 2"],
  lyricsSource: "mashup-snapshot",
}

test("songPresetToDraft restores all arrangement fields", () => {
  const draft = songPresetToDraft(preset)

  assert.deepEqual(draft.keys, ["G", "A"])
  assert.deepEqual(draft.tempos, [72, 84])
  assert.deepEqual(draft.sectionOrder, ["Intro", "V", "C"])
  assert.deepEqual(draft.lyrics, ["line 1", "line 2"])
  assert.deepEqual(draft.sectionLyricsMap, { 0: [0], 2: [1] })
  assert.equal(draft.notes, "soft intro")
  assert.deepEqual(draft.sheetMusicFileIds, ["sheet-1"])
  assert.equal(draft.youtubeReference, "https://www.youtube.com/watch?v=W1uussHIX9o")
  assert.equal(draft.youtubeTitle, "Invitation")
  assert.equal(draft.isDefault, true)
  assert.equal(draft.appliedPresetId, "preset-1")
  assert.equal(draft.displayTitle, "초대 + 부르심")
  assert.equal(draft.pdfMetadata?.files[0]?.sheetMusicFileId, "sheet-1")
})

test("arrangementDraftToSongPresetData preserves edited arrangement fields", () => {
  const draft = songPresetToDraft(preset)
  const data = arrangementDraftToSongPresetData({
    ...draft,
    name: " updated ",
    displayTitle: " updated title ",
    notes: " soft intro ",
    youtubeReference: "https://youtu.be/W1uussHIX9o",
  })

  assert.equal(data.name, "updated")
  assert.equal(data.displayTitle, "updated title")
  assert.deepEqual(data.keys, ["G", "A"])
  assert.deepEqual(data.tempos, [72, 84])
  assert.deepEqual(data.sectionOrder, ["Intro", "V", "C"])
  assert.deepEqual(data.lyrics, ["line 1", "line 2"])
  assert.deepEqual(data.sectionLyricsMap, { 0: [0], 2: [1] })
  assert.equal(data.notes, "soft intro")
  assert.deepEqual(data.sheetMusicFileIds, ["sheet-1"])
  assert.equal(data.youtubeReference, "W1uussHIX9o")
  assert.equal(data.youtubeTitle, "Invitation")
  assert.equal(data.isDefault, true)
  assert.equal(data.pdfMetadata?.files[0]?.sheetMusicFileId, "sheet-1")
})

test("empty preset sheet music rows mean all sheet music in the editor", () => {
  const draft = songPresetToDraft({ ...preset, sheetMusicFileIds: [] })

  assert.equal(draft.sheetMusicFileIds, null)
})

test("songPresetToDraft uses server-resolved lyrics instead of raw storage", () => {
  const draft = songPresetToDraft({
    ...preset,
    presetType: "single",
    lyrics: JSON.stringify([]),
    songLyrics: ["canonical fallback page"],
    resolvedLyrics: ["server-resolved page"],
    lyricsSource: "song",
  })

  assert.deepEqual(draft.lyrics, ["server-resolved page"])
})

test("missing preset pdf metadata is normalized to null in the editor draft", () => {
  const draft = songPresetToDraft({ ...preset, pdfMetadata: null })

  assert.equal(draft.pdfMetadata, null)
})
