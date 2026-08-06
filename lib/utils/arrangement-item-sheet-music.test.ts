import assert from "node:assert/strict"
import { test } from "vitest"
import type { SheetMusicFile } from "@/lib/types"
import { combineArrangementItemSheetMusic } from "./arrangement-item-sheet-music.ts"

const sm = (id: string): SheetMusicFile => ({ id }) as SheetMusicFile

test("returns a single song's sheet music unchanged", () => {
  const songs = [{ sheetMusic: [sm("a1"), sm("a2")] }]
  assert.deepEqual(
    combineArrangementItemSheetMusic(songs).map((f) => f.id),
    ["a1", "a2"],
  )
})

test("combines both mashup songs' sheet music (front song no longer wins alone)", () => {
  const songs = [
    { sheetMusic: [sm("a1")] }, // front song
    { sheetMusic: [sm("b1"), sm("b2")] }, // back song
  ]
  assert.deepEqual(
    combineArrangementItemSheetMusic(songs).map((f) => f.id),
    ["a1", "b1", "b2"],
  )
})

test("de-duplicates shared file ids while preserving first-seen order", () => {
  // Both rows carry the same explicit combined selection.
  const songs = [
    { sheetMusic: [sm("a1"), sm("b1")] },
    { sheetMusic: [sm("a1"), sm("b1")] },
  ]
  assert.deepEqual(
    combineArrangementItemSheetMusic(songs).map((f) => f.id),
    ["a1", "b1"],
  )
})

test("returns an empty list when no song has sheet music", () => {
  assert.deepEqual(combineArrangementItemSheetMusic([{ sheetMusic: [] }, { sheetMusic: [] }]), [])
})
