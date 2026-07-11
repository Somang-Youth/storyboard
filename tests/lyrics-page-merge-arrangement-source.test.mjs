import assert from "node:assert/strict"
import { test } from "vitest"
import { readFile } from "node:fs/promises"

test("arrangement editor remaps section-lyrics map on page removal and merge", async () => {
  const source = await readFile(
    new URL(
      "../components/shared/arrangement-editor/arrangement-editor.tsx",
      import.meta.url,
    ),
    "utf8",
  )

  assert.match(source, /shiftSectionLyricsMapForRemoval/)
  assert.match(source, /mergeSectionLyricsMapPages/)
  assert.match(source, /data\.removedAt !== undefined/)
  assert.match(source, /data\.mergedAt !== undefined/)
  assert.match(source, /mergedAt\?: number/)
  assert.match(source, /removedAt\?: number/)
})

test("override editor fields propagates the extended lyrics onChange contract", async () => {
  const source = await readFile(
    new URL("../components/shared/override-editor-fields.tsx", import.meta.url),
    "utf8",
  )

  assert.match(source, /mergedAt\?: number/)
  assert.match(source, /removedAt\?: number/)
})
