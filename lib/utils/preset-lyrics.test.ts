import assert from "node:assert/strict"
import { test } from "vitest"
import { resolvePresetLyrics } from "./preset-lyrics.ts"

test("single preset override wins over canonical song lyrics", () => {
  assert.deepEqual(resolvePresetLyrics({
    presetType: "single",
    lyrics: JSON.stringify(["preset page"]),
    songLyrics: ["song page"],
  }), {
    lyrics: ["preset page"],
    source: "preset-override",
  })
})

test("single preset falls back to canonical song lyrics", () => {
  assert.deepEqual(resolvePresetLyrics({
    presetType: "single",
    lyrics: JSON.stringify([]),
    songLyrics: ["song page 1", "song page 2"],
  }), {
    lyrics: ["song page 1", "song page 2"],
    source: "song",
  })
})

test("mashup snapshot wins over member fallback", () => {
  assert.deepEqual(resolvePresetLyrics({
    presetType: "mashup",
    lyrics: JSON.stringify(["snapshot page"]),
    fallbackLyrics: ["member page"],
  }), {
    lyrics: ["snapshot page"],
    source: "mashup-snapshot",
  })
})

test("empty mashup snapshot uses ordered member fallback", () => {
  assert.deepEqual(resolvePresetLyrics({
    presetType: "mashup",
    lyrics: JSON.stringify([]),
    fallbackLyrics: ["first member", "second member"],
  }), {
    lyrics: ["first member", "second member"],
    source: "mashup-fallback",
  })
})

test("malformed raw lyrics continue to the applicable fallback", () => {
  assert.deepEqual(resolvePresetLyrics({
    presetType: "single",
    lyrics: "not-json",
    songLyrics: ["safe song page"],
  }), {
    lyrics: ["safe song page"],
    source: "song",
  })
})

test("non-array raw lyrics and missing fallback resolve empty", () => {
  assert.deepEqual(resolvePresetLyrics({
    presetType: "single",
    lyrics: JSON.stringify({ page: "wrong shape" }),
  }), {
    lyrics: [],
    source: "empty",
  })
})
