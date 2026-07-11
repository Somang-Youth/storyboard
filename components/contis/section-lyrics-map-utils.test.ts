import assert from "node:assert/strict"
import { test } from "vitest"

import {
  addLyricsPageToSection,
  moveLyricsPageOccurrence,
  pruneInvalidLyricsPages,
  removeLyricsPageOccurrence,
  shiftSectionLyricsMapForRemoval,
  mergeSectionLyricsMapPages,
} from "./section-lyrics-map-utils.ts"

test("allows adding the same lyrics page to the same section more than once in click order", () => {
  const initial: Record<number, number[]> = {}

  const first = addLyricsPageToSection(initial, 1, 0)
  const second = addLyricsPageToSection(first, 1, 2)
  const result = addLyricsPageToSection(second, 1, 0)

  assert.deepEqual(result, { 1: [0, 2, 0] })
  assert.deepEqual(initial, {})
  assert.deepEqual(first, { 1: [0] })
  assert.deepEqual(second, { 1: [0, 2] })
})

test("removes only the occurrence at the requested position", () => {
  const initial = { 1: [0, 2, 0] }

  const result = removeLyricsPageOccurrence(initial, 1, 1)

  assert.deepEqual(result, { 1: [0, 0] })
  assert.deepEqual(initial, { 1: [0, 2, 0] })
})

test("removes the section key when the last occurrence is removed", () => {
  const initial = { 1: [2] }

  const result = removeLyricsPageOccurrence(initial, 1, 0)

  assert.deepEqual(result, {})
  assert.deepEqual(initial, { 1: [2] })
})

test("moves a lyrics page occurrence within the selected order", () => {
  const initial = { 1: [0, 2, 0] }

  const movedUp = moveLyricsPageOccurrence(initial, 1, 2, "up")
  const movedDown = moveLyricsPageOccurrence(initial, 1, 0, "down")

  assert.deepEqual(movedUp, { 1: [0, 0, 2] })
  assert.deepEqual(movedDown, { 1: [2, 0, 0] })
  assert.deepEqual(initial, { 1: [0, 2, 0] })
})

test("does not move a lyrics page occurrence beyond the selected order bounds", () => {
  const initial = { 1: [0, 2] }

  assert.strictEqual(moveLyricsPageOccurrence(initial, 1, 0, "up"), initial)
  assert.strictEqual(moveLyricsPageOccurrence(initial, 1, 1, "down"), initial)
  assert.strictEqual(moveLyricsPageOccurrence(initial, 2, 0, "down"), initial)
})

test("prunes invalid page indexes without deduping valid repeated indexes", () => {
  const initial = { 0: [0, 2, 0, 4], 1: [3] }

  const result = pruneInvalidLyricsPages(initial, 3)

  assert.deepEqual(result, { 0: [0, 2, 0] })
  assert.deepEqual(initial, { 0: [0, 2, 0, 4], 1: [3] })
})

test("removal shifts later page indices down and drops the removed index", () => {
  assert.deepEqual(
    shiftSectionLyricsMapForRemoval({ 0: [0, 1], 1: [2, 3] }, 1),
    { 0: [0], 1: [1, 2] },
  )
})

test("removal drops sections left empty", () => {
  assert.deepEqual(shiftSectionLyricsMapForRemoval({ 0: [1] }, 1), {})
})

test("merge maps the absorbed page onto the kept page and shifts the rest down", () => {
  // keptIndex=2, absorbedIndex=3
  assert.deepEqual(
    mergeSectionLyricsMapPages({ 0: [2], 1: [3, 4] }, 2),
    { 0: [2], 1: [2, 3] },
  )
})

test("merge collapses an adjacent kept+absorbed reference into a single page", () => {
  // 한 섹션이 합쳐질 두 페이지(2,3)에 걸쳐 있던 흔한 경우
  assert.deepEqual(mergeSectionLyricsMapPages({ 0: [2, 3] }, 2), { 0: [2] })
})

test("merge preserves intentional repeats that are not the merge adjacency", () => {
  assert.deepEqual(
    mergeSectionLyricsMapPages({ 0: [2, 2], 1: [3, 3] }, 2),
    { 0: [2, 2], 1: [2, 2] },
  )
})
