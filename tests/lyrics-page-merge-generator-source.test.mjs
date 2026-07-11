import assert from "node:assert/strict"
import { test } from "vitest"
import { readFile } from "node:fs/promises"

test("generator dialog wires a between-page merge button guarded by visual length", async () => {
  const source = await readFile(
    new URL(
      "../components/contis/sheet-music-lyrics-generator-dialog.tsx",
      import.meta.url,
    ),
    "utf8",
  )

  assert.match(source, /canMergeLyricsPages, mergeLyricsPages|mergeLyricsPages, canMergeLyricsPages/)
  assert.match(source, /const mergeGeneratedPages = \(index: number\) =>/)
  assert.match(source, /\.splice\(index, 2, mergeLyricsPages\(/)
  assert.match(source, /index < generatedLyrics\.length - 1/)
  assert.match(source, /disabled=\{!canMergeLyricsPages\(/)
  assert.match(source, /합치기/)
})
