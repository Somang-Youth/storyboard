import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { test } from "vitest"

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8")

test("conti summary table enables editing for mashup items", async () => {
  const table = await read("components/contis/conti-song-summary-table.tsx")

  // Mashup items are no longer excluded from editing.
  assert.match(table, /const canEdit = Boolean\(onEdit\)/)
  assert.doesNotMatch(table, /!isMashupItem\(item\) && Boolean\(onEdit\)/)
})

test("conti detail routes mashup rows to the dedicated mashup editor", async () => {
  const detail = await read("components/contis/conti-detail.tsx")

  assert.match(detail, /import \{ ContiMashupEditor \}/)
  assert.match(detail, /contiSong\.mashupGroupId/)
  assert.match(detail, /<ContiMashupEditor/)
})

test("mashup conti editor hides single-song preset controls and saves to the group", async () => {
  const editor = await read("components/contis/conti-mashup-editor.tsx")

  assert.match(editor, /updateMashupContiSongs/)
  assert.match(editor, /draftToMashupContiSongOverrides/)
  // The single-song preset picker / save-as-preset would break the group.
  assert.doesNotMatch(editor, /presetOptions=/)
  assert.doesNotMatch(editor, /onLoadPreset/)
  assert.doesNotMatch(editor, /onSaveAsPreset/)
})

test("mashup conti editor can save changes back to the shared mashup preset", async () => {
  const editor = await read("components/contis/conti-mashup-editor.tsx")

  // Saves to the shared mashup preset (updateSongPreset) in addition to conti.
  assert.match(editor, /onSaveToPreset/)
  assert.match(editor, /updateSongPreset/)
})

test("arrangement editor renders a secondary save-to-preset action when provided", async () => {
  const editor = await read("components/shared/arrangement-editor/arrangement-editor.tsx")

  assert.match(editor, /onSaveToPreset && \(/)
  assert.match(editor, /handleSaveToPreset/)
  assert.match(editor, /saveToPresetLabel/)
})

test("repository updates both grouped rows without touching presetId", async () => {
  const repository = await read("lib/repositories/storyboard/turso-repository.ts")

  assert.match(repository, /async updateMashupContiSongs\(input\)/)
  assert.match(repository, /if \(rows\.length !== 2\) throw new Error\("MASHUP_GROUP_NOT_FOUND"\)/)
  // Writes the same serialized overrides to every row in the group.
  assert.match(
    repository,
    /updateMashupContiSongs[\s\S]*for \(const row of rows\)[\s\S]*tx\.update\(contiSongs\)/,
  )
})

test("mashup override builder omits presetId so the group stays applied", async () => {
  const overrides = await read("lib/utils/mashup-conti-overrides.ts")

  // No `presetId:` property assignment in the returned overrides.
  assert.doesNotMatch(overrides, /presetId:/)
})
