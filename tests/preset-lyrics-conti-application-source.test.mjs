import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { test } from "vitest"

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8")

test("Turso preset hydration attaches resolved lyrics and source", async () => {
  const repository = await read("lib/repositories/storyboard/turso-repository.ts")

  assert.match(repository, /async function hydrateSongPreset/)
  assert.match(repository, /resolvePresetLyrics\(hydrated\)/)
  assert.match(repository, /resolvedLyrics: resolution\.lyrics/)
  assert.match(repository, /lyricsSource: resolution\.source/)
})

test("resolved preset actions expose the resolved DTO", async () => {
  const [types, actions] = await Promise.all([
    read("lib/repositories/storyboard/types.ts"),
    read("lib/actions/song-presets.ts"),
  ])

  assert.match(types, /Promise<ResolvedSongPresetWithSheetMusic\[\]>/)
  assert.match(types, /Promise<ResolvedSongPresetWithSheetMusic \| null>/)
  assert.match(actions, /ActionResult<ResolvedSongPresetWithSheetMusic\[\]>/)
})

test("server conti application hydrates presets before conversion", async () => {
  const repository = await read("lib/repositories/storyboard/turso-repository.ts")

  assert.match(
    repository,
    /getPresetOverridesForSong[\s\S]*hydrateSongPreset[\s\S]*songPresetToContiOverrides/,
  )
  assert.doesNotMatch(
    repository,
    /appliedPresetOverrides = songPresetToContiOverrides\(preset\)/,
  )
})

test("conti clients consume resolved preset lyrics", async () => {
  const [picker, editor] = await Promise.all([
    read("components/contis/song-picker.tsx"),
    read("components/contis/conti-song-editor.tsx"),
  ])

  for (const source of [picker, editor]) {
    assert.match(source, /getPresetsForSongWithSheetMusic/)
    assert.doesNotMatch(source, /getPresetSheetMusicFileIds/)
    assert.doesNotMatch(source, /preset\.lyrics/)
  }

  assert.match(picker, /songPresetToContiOverrides/)
  assert.match(editor, /songPresetToDraft/)
})
