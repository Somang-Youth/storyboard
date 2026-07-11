import assert from "node:assert/strict"
import { test } from "vitest"
import {
  getLyricsLineVisualLength,
  normalizeGeneratedLyricsPage,
  normalizeGeneratedLyricsPages,
  validateLyricsPage,
  flattenLyricsPageToLine,
  canMergeLyricsPages,
  mergeLyricsPages,
} from "./lyrics-validation.ts"

test("calculates Korean lyric visual length with PPT-derived weights", () => {
  assert.equal(getLyricsLineVisualLength("가나다"), 3)
  assert.equal(getLyricsLineVisualLength("가 나"), 2.3)
  assert.equal(getLyricsLineVisualLength("ABC 123"), 4.5)
  assert.equal(
    Number(getLyricsLineVisualLength("주 사랑해요 온 맘 다하여 말로 다 할 수 없어").toFixed(1)),
    19.7,
  )
})

test("does not warn for a known line that fits the worship PPT template", () => {
  assert.deepEqual(
    validateLyricsPage("주 사랑해요 온 맘 다하여 말로 다 할 수 없어"),
    [],
  )
})

test("allows a single line at the visual length limit", () => {
  assert.deepEqual(validateLyricsPage("가".repeat(23)), [])
})

test("warns when a single line exceeds the visual length limit", () => {
  assert.deepEqual(validateLyricsPage("가".repeat(24)), [
    {
      type: "no-line-break",
      message: "줄바꿈이 필요합니다",
    },
  ])
})

test("warns when any line in a multiline page exceeds the visual length limit", () => {
  assert.deepEqual(validateLyricsPage(`짧은 줄\n${"가".repeat(24)}`), [
    {
      type: "line-too-long",
      message: "줄이 너무 깁니다",
    },
  ])
})

test("keeps the existing three-line page warning", () => {
  assert.deepEqual(validateLyricsPage("한 줄\n두 줄\n세 줄"), [
    {
      type: "too-many-lines",
      message: "줄 수가 너무 많습니다",
    },
  ])
})

test("merges generated three-line pages into two lines when each line still fits", () => {
  assert.equal(
    normalizeGeneratedLyricsPage("수많은 멜로디와\n찬양들을 드렸지만\n다시 고백하길 원하네"),
    "수많은 멜로디와 찬양들을 드렸지만\n다시 고백하길 원하네",
  )
})

test("keeps generated three-line pages when no two-line merge fits", () => {
  const page = `${"가".repeat(20)}\n${"나".repeat(20)}\n${"다".repeat(20)}`

  assert.equal(normalizeGeneratedLyricsPage(page), page)
})

test("rebalances generated page boundaries when a short page ends with a connective phrase", () => {
  assert.deepEqual(
    normalizeGeneratedLyricsPages([
      "수많은 멜로디와\n찬양들을 드렸지만",
      "다시 고백하길 원하네\n주님은 나의 사랑",
    ]),
    [
      "수많은 멜로디와 찬양들을 드렸지만\n다시 고백하길 원하네",
      "주님은 나의 사랑",
    ],
  )
})

test("keeps normal two-line generated pages at their page boundary", () => {
  assert.deepEqual(
    normalizeGeneratedLyricsPages([
      "내 마음을 가득 채운\n주 향한 찬양과 사랑",
      "어떻게 표현할 수 있나\n수많은 찬양들로",
    ]),
    [
      "내 마음을 가득 채운\n주 향한 찬양과 사랑",
      "어떻게 표현할 수 있나\n수많은 찬양들로",
    ],
  )
})

test("flattens a multi-line page into one space-joined line, dropping blanks", () => {
  assert.equal(
    flattenLyricsPageToLine("수많은 멜로디와\n찬양들을 드렸지만"),
    "수많은 멜로디와 찬양들을 드렸지만",
  )
  assert.equal(flattenLyricsPageToLine("한 줄\n\n  다음 줄  "), "한 줄 다음 줄")
  assert.equal(flattenLyricsPageToLine(""), "")
})

test("allows merge when both flattened lines fit the visual length limit", () => {
  assert.equal(
    canMergeLyricsPages(`${"가".repeat(10)}\n${"가".repeat(10)}`, "나".repeat(23)),
    true,
  )
})

test("blocks merge when a flattened line exceeds the visual length limit", () => {
  // 두 번째 페이지 평탄화 = 24 > 23
  assert.equal(
    canMergeLyricsPages(`${"가".repeat(11)}\n${"가".repeat(11)}`, "나".repeat(24)),
    false,
  )
  // 첫 페이지 평탄화 = 12 + 0.3 + 12 = 24.3 > 23
  assert.equal(
    canMergeLyricsPages(`${"가".repeat(12)}\n${"가".repeat(12)}`, "나"),
    false,
  )
})

test("merges two pages into a two-line page, one line each", () => {
  assert.equal(
    mergeLyricsPages("수많은 멜로디와\n찬양들을 드렸지만", "다시 고백하길\n원하네"),
    "수많은 멜로디와 찬양들을 드렸지만\n다시 고백하길 원하네",
  )
})

test("merging with an empty page yields a single-line page", () => {
  assert.equal(mergeLyricsPages("주님은 나의 사랑", ""), "주님은 나의 사랑")
})
