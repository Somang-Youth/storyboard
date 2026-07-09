import assert from "node:assert/strict"
import { test } from "vitest"
import { readFile } from "node:fs/promises"

test("lyrics editor emits mergedAt/removedAt and renders a guarded merge button", async () => {
  const source = await readFile(
    new URL("../components/contis/lyrics-editor.tsx", import.meta.url),
    "utf8",
  )

  // onChange 계약 확장
  assert.match(source, /mergedAt\?: number/)
  assert.match(source, /removedAt\?: number/)
  // pending refs
  assert.match(source, /const pendingMergeRef = useRef<number \| null>\(null\)/)
  assert.match(source, /const pendingRemoveRef = useRef<number \| null>\(null\)/)
  // effect가 두 신호를 실어 보냄
  assert.match(source, /mergedAt: pendingMergeRef\.current \?\? undefined/)
  assert.match(source, /removedAt: pendingRemoveRef\.current \?\? undefined/)
  // removePage가 removedAt 신호를 세팅
  assert.match(source, /pendingRemoveRef\.current = index/)
  // merge 핸들러 + 버튼
  assert.match(source, /const mergePages = \(index: number\) =>/)
  assert.match(source, /pendingMergeRef\.current = index/)
  assert.match(source, /disabled=\{!canMergeLyricsPages\(lyrics\[index\], lyrics\[index \+ 1\]\)\}/)
  assert.match(source, /합치기/)
})
