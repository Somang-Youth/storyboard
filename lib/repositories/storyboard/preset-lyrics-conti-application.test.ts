import assert from "node:assert/strict"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, test } from "vitest"
import { getTursoDb } from "@/lib/db/turso"
import {
  contis,
  contiSongs,
  presetSheetMusic,
  sheetMusicFiles,
  songPresets,
  songPresetSongs,
  songs,
} from "@/lib/db/turso-schema"
import { tursoStoryboardRepository } from "./turso-repository.ts"

const NOW = "2026-07-12T00:00:00.000Z"
const previousTursoUrl = process.env.TURSO_DATABASE_URL
const previousTursoToken = process.env.TURSO_AUTH_TOKEN
const migrationUrls = [
  new URL("../../../drizzle/turso/0000_mixed_wolverine.sql", import.meta.url),
  new URL("../../../drizzle/turso/0001_powerful_deathstrike.sql", import.meta.url),
  new URL("../../../drizzle/turso/0002_busy_james_howlett.sql", import.meta.url),
  new URL("../../../drizzle/turso/0003_sharp_blade.sql", import.meta.url),
]

let db: ReturnType<typeof getTursoDb>
let tempDir: string

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name]
  } else {
    process.env[name] = value
  }
}

async function seedSong(
  id: string,
  name: string,
  canonicalLyrics: readonly string[],
) {
  await db.insert(songs).values({
    id,
    name,
    lyrics: JSON.stringify(canonicalLyrics),
    createdAt: NOW,
    updatedAt: NOW,
  })
}

async function seedEmptySinglePreset(songId: string, presetId: string) {
  await db.insert(songPresets).values({
    id: presetId,
    songId,
    presetType: "single",
    displayTitle: null,
    mashupPairKey: null,
    name: `Preset for ${songId}`,
    keys: JSON.stringify([`key:${songId}`]),
    tempos: JSON.stringify([72]),
    sectionOrder: JSON.stringify(["V"]),
    lyrics: JSON.stringify([]),
    sectionLyricsMap: JSON.stringify({ 0: [0] }),
    notes: `notes:${songId}`,
    youtubeReference: null,
    youtubeTitle: null,
    pdfMetadata: null,
    isDefault: false,
    sortOrder: 0,
    createdAt: NOW,
    updatedAt: NOW,
  })
  await db.insert(songPresetSongs).values({
    id: `${presetId}:song:0`,
    presetId,
    songId,
    sortOrder: 0,
    partLabel: null,
  })
}

async function seedConti(id: string) {
  await db.insert(contis).values({
    id,
    title: "Repository behavior test",
    date: "2026-07-12",
    description: null,
    createdAt: NOW,
    updatedAt: NOW,
  })
}

function contiSongRow({
  id,
  contiId,
  songId,
  sortOrder,
  lyrics,
  presetId = null,
  mashupGroupId = null,
  mashupPartOrder = null,
  preMashupPresetId = null,
}: {
  id: string
  contiId: string
  songId: string
  sortOrder: number
  lyrics: readonly string[]
  presetId?: string | null
  mashupGroupId?: string | null
  mashupPartOrder?: number | null
  preMashupPresetId?: string | null
}) {
  return {
    id,
    contiId,
    songId,
    sortOrder,
    keys: JSON.stringify([`snapshot-key:${id}`]),
    tempos: JSON.stringify([88]),
    sectionOrder: JSON.stringify(["snapshot-section"]),
    lyrics: JSON.stringify(lyrics),
    sectionLyricsMap: JSON.stringify({ 0: [0] }),
    notes: `snapshot-notes:${id}`,
    sheetMusicFileIds: null,
    presetId,
    mashupGroupId,
    mashupPartOrder,
    preMashupPresetId,
    createdAt: NOW,
    updatedAt: NOW,
  }
}

beforeAll(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "selah-preset-lyrics-test-"))
  process.env.TURSO_DATABASE_URL = `file:${join(tempDir, "test.db")}`
  process.env.TURSO_AUTH_TOKEN = "test-token"
  db = getTursoDb()

  for (const migrationUrl of migrationUrls) {
    const migration = await readFile(migrationUrl, "utf8")
    await db.$client.executeMultiple(
      migration.replaceAll("--> statement-breakpoint", ""),
    )
  }
})

beforeEach(async () => {
  await db.delete(contiSongs)
  await db.delete(contis)
  await db.delete(presetSheetMusic)
  await db.delete(songPresetSongs)
  await db.delete(songPresets)
  await db.delete(sheetMusicFiles)
  await db.delete(songs)
})

afterAll(async () => {
  db?.$client.close()
  await rm(tempDir, { recursive: true, force: true })
  restoreEnv("TURSO_DATABASE_URL", previousTursoUrl)
  restoreEnv("TURSO_AUTH_TOKEN", previousTursoToken)
})

test("YouTube import snapshots canonical lyrics from an empty single preset without changing unrelated rows", async () => {
  const canonicalLyrics = ["canonical target page 1", "canonical target page 2"]
  await seedSong("song-target", "Target Song", canonicalLyrics)
  await seedEmptySinglePreset("song-target", "preset-target")
  await seedSong("song-unrelated", "Unrelated Song", ["unrelated canonical"])
  await seedConti("conti-youtube")

  await db.insert(contiSongs).values(contiSongRow({
    id: "row-unrelated",
    contiId: "conti-youtube",
    songId: "song-unrelated",
    sortOrder: 0,
    lyrics: ["keep this snapshot"],
  }))
  const unrelatedBefore = await db.query.contiSongs.findFirst({
    where: eq(contiSongs.id, "row-unrelated"),
  })
  assert.ok(unrelatedBefore)

  const result = await tursoStoryboardRepository.batchImportSongsToConti(
    "conti-youtube",
    [{
      songId: "song-target",
      songName: "Target Song",
      newSongName: null,
      videoId: "youtube-video-id",
      title: "YouTube arrangement",
      presetId: "preset-target",
      createNewPreset: false,
      alreadyInConti: false,
      replaceExistingYoutube: false,
    }],
  )

  const imported = await db.query.contiSongs.findFirst({
    where: eq(contiSongs.songId, "song-target"),
  })
  const unrelatedAfter = await db.query.contiSongs.findFirst({
    where: eq(contiSongs.id, "row-unrelated"),
  })

  assert.deepEqual(result, {
    added: 1,
    created: 0,
    presetUpdated: 0,
    mashupsApplied: 0,
  })
  assert.ok(imported)
  assert.deepEqual(JSON.parse(imported.lyrics ?? "[]"), canonicalLyrics)
  assert.equal(imported.presetId, "preset-target")
  assert.deepEqual(unrelatedAfter, unrelatedBefore)
})

test("mashup restore snapshots canonical lyrics from empty single presets without changing unrelated rows", async () => {
  const firstCanonicalLyrics = ["first canonical page"]
  const secondCanonicalLyrics = ["second canonical page 1", "second canonical page 2"]
  await seedSong("song-first", "First Song", firstCanonicalLyrics)
  await seedEmptySinglePreset("song-first", "preset-first")
  await seedSong("song-second", "Second Song", secondCanonicalLyrics)
  await seedEmptySinglePreset("song-second", "preset-second")
  await seedSong("song-unrelated", "Unrelated Song", ["unrelated canonical"])
  await seedConti("conti-mashup")

  await db.insert(contiSongs).values([
    contiSongRow({
      id: "row-first",
      contiId: "conti-mashup",
      songId: "song-first",
      sortOrder: 0,
      lyrics: ["mashup snapshot"],
      mashupGroupId: "group-1",
      mashupPartOrder: 0,
      preMashupPresetId: "preset-first",
    }),
    contiSongRow({
      id: "row-second",
      contiId: "conti-mashup",
      songId: "song-second",
      sortOrder: 1,
      lyrics: ["mashup snapshot"],
      mashupGroupId: "group-1",
      mashupPartOrder: 1,
      preMashupPresetId: "preset-second",
    }),
    contiSongRow({
      id: "row-unrelated",
      contiId: "conti-mashup",
      songId: "song-unrelated",
      sortOrder: 2,
      lyrics: ["keep this unrelated snapshot"],
    }),
  ])
  const unrelatedBefore = await db.query.contiSongs.findFirst({
    where: eq(contiSongs.id, "row-unrelated"),
  })
  assert.ok(unrelatedBefore)

  await tursoStoryboardRepository.splitMashup({
    contiId: "conti-mashup",
    mashupGroupId: "group-1",
    mode: "restore",
  })

  const firstRestored = await db.query.contiSongs.findFirst({
    where: eq(contiSongs.id, "row-first"),
  })
  const secondRestored = await db.query.contiSongs.findFirst({
    where: eq(contiSongs.id, "row-second"),
  })
  const unrelatedAfter = await db.query.contiSongs.findFirst({
    where: eq(contiSongs.id, "row-unrelated"),
  })

  assert.ok(firstRestored)
  assert.deepEqual(JSON.parse(firstRestored.lyrics ?? "[]"), firstCanonicalLyrics)
  assert.equal(firstRestored.presetId, "preset-first")
  assert.equal(firstRestored.mashupGroupId, null)
  assert.equal(firstRestored.preMashupPresetId, null)

  assert.ok(secondRestored)
  assert.deepEqual(JSON.parse(secondRestored.lyrics ?? "[]"), secondCanonicalLyrics)
  assert.equal(secondRestored.presetId, "preset-second")
  assert.equal(secondRestored.mashupGroupId, null)
  assert.equal(secondRestored.preMashupPresetId, null)
  assert.deepEqual(unrelatedAfter, unrelatedBefore)
})
