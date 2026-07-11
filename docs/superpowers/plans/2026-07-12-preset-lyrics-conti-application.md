# Preset Lyrics Conti Application Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every preset-to-conti path use server-resolved song lyrics while preserving single-preset overrides and mashup snapshot semantics.

**Architecture:** A pure `resolvePresetLyrics` function owns storage precedence. Turso repository hydration adds `resolvedLyrics` and `lyricsSource` to an explicit resolved preset DTO; shared draft/conti converters consume that DTO, and conti clients never inspect raw `preset.lyrics`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Turso/libSQL, Drizzle ORM, Vitest 4, ESLint 9.

## Global Constraints

- Do not add a DB schema migration or mutate Production data; the 2026-07-12 audit found zero non-empty single-preset lyric rows.
- Do not rewrite existing `conti_songs.lyrics`; only a new preset application or explicit preset reload receives current resolved lyrics.
- Resolution order is single preset override → canonical song lyrics, and mashup snapshot → ordered member-song fallback.
- Frontend code must consume `resolvedLyrics`; it must not infer ownership from raw `preset.lyrics` or `presetType`.
- Keep raw `SongPreset.lyrics` in DTOs for preset editing/save-scope behavior.
- Keep `sectionLyricsMap` on the preset/conti arrangement without automatic index repair.
- Treat malformed or non-array raw preset JSON as empty and continue to the applicable fallback.
- Add no runtime dependency.
- All shell commands in this workspace use the `rtk` prefix.

---

## File Structure

- Create `lib/utils/preset-lyrics.ts`: pure parsing and source-resolution policy.
- Create `lib/utils/preset-lyrics.test.ts`: decision-table tests for every lyrics source.
- Modify `lib/types.ts`: `PresetLyricsSource` and `ResolvedSongPresetWithSheetMusic` contracts.
- Modify `lib/repositories/storyboard/types.ts`: resolved preset repository return types.
- Modify `lib/repositories/storyboard/turso-repository.ts`: one hydration path that attaches resolved fields and feeds server-side conti application.
- Modify `lib/actions/song-presets.ts`: resolved preset action return types; retain the lightweight raw action used only for YouTube selection metadata.
- Modify `lib/utils/song-preset-draft.ts`: drafts consume `resolvedLyrics`.
- Modify `lib/utils/song-preset-draft.test.ts`: resolved draft regression coverage.
- Modify `lib/utils/preset-overrides.ts`: conti snapshots require `resolvedLyrics`.
- Modify `lib/utils/preset-overrides.test.ts`: canonical-lyrics-to-conti regression coverage.
- Modify `components/shared/arrangement-editor/types.ts`: preset options use the resolved DTO.
- Modify `components/songs/preset-editor.tsx`: resolved preset prop.
- Modify `components/songs/preset-list.tsx`: resolved preset list/state.
- Modify `components/songs/mashup-preset-dialog.tsx`: resolved callback type.
- Modify `components/contis/mashup-connect-dialog.tsx`: resolved preset state type.
- Modify `components/contis/conti-song-editor.tsx`: load resolved presets and reuse the shared draft converter.
- Modify `components/contis/song-picker.tsx`: apply default/manual presets through the shared conti converter.
- Create `tests/preset-lyrics-conti-application-source.test.mjs`: source guards for repository and client wiring.

---

### Task 1: Lyrics Resolution Contract

**Files:**
- Create: `lib/utils/preset-lyrics.ts`
- Create: `lib/utils/preset-lyrics.test.ts`
- Modify: `lib/types.ts:142-150`

**Interfaces:**
- Consumes: existing `SongPresetWithSheetMusic.presetType`, `.lyrics`, `.songLyrics`, and `.fallbackLyrics`.
- Produces: `PresetLyricsSource`, `ResolvedSongPresetWithSheetMusic`, and `resolvePresetLyrics(input): { lyrics: string[]; source: PresetLyricsSource }`.

- [ ] **Step 1: Write the failing resolver decision-table tests**

Create `lib/utils/preset-lyrics.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the resolver test and confirm it fails**

Run:

```bash
rtk pnpm vitest run lib/utils/preset-lyrics.test.ts
```

Expected: FAIL because `lib/utils/preset-lyrics.ts` does not exist.

- [ ] **Step 3: Add the shared types**

In `lib/types.ts`, add the source union near the existing preset types and add the resolved DTO after `SongPresetWithSheetMusic`:

```ts
export type PresetLyricsSource =
  | "preset-override"
  | "song"
  | "mashup-snapshot"
  | "mashup-fallback"
  | "empty"

export interface ResolvedSongPresetWithSheetMusic extends SongPresetWithSheetMusic {
  resolvedLyrics: string[]
  lyricsSource: PresetLyricsSource
}
```

- [ ] **Step 4: Implement the pure resolver**

Create `lib/utils/preset-lyrics.ts`:

```ts
import type {
  PresetLyricsSource,
  SongPresetWithSheetMusic,
} from "../types.ts"

type PresetLyricsInput = Pick<
  SongPresetWithSheetMusic,
  "presetType" | "lyrics" | "songLyrics" | "fallbackLyrics"
>

interface ResolvedPresetLyrics {
  lyrics: string[]
  source: PresetLyricsSource
}

function parseStoredLyrics(field: string | null): string[] {
  if (!field) return []

  try {
    const parsed = JSON.parse(field) as unknown
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : []
  } catch {
    return []
  }
}

export function resolvePresetLyrics(
  input: PresetLyricsInput,
): ResolvedPresetLyrics {
  const storedLyrics = parseStoredLyrics(input.lyrics)

  if (storedLyrics.length > 0) {
    return {
      lyrics: storedLyrics,
      source: input.presetType === "mashup"
        ? "mashup-snapshot"
        : "preset-override",
    }
  }

  if (input.presetType === "single" && input.songLyrics?.length) {
    return { lyrics: [...input.songLyrics], source: "song" }
  }

  if (input.presetType === "mashup" && input.fallbackLyrics?.length) {
    return { lyrics: [...input.fallbackLyrics], source: "mashup-fallback" }
  }

  return { lyrics: [], source: "empty" }
}
```

- [ ] **Step 5: Run the resolver test and typecheck**

Run:

```bash
rtk pnpm vitest run lib/utils/preset-lyrics.test.ts
rtk pnpm exec tsc --noEmit
```

Expected: the resolver test passes and TypeScript reports no errors because no existing consumer requires the new DTO yet.

- [ ] **Step 6: Commit the resolver contract**

```bash
rtk git add lib/types.ts lib/utils/preset-lyrics.ts lib/utils/preset-lyrics.test.ts
rtk git commit -m "feat: add preset lyrics resolution contract"
```

---

### Task 2: Server-Resolved Preset DTO

**Files:**
- Modify: `lib/types.ts:137-150`
- Modify: `lib/repositories/storyboard/types.ts:232-240`
- Modify: `lib/repositories/storyboard/turso-repository.ts:29-40, 344-379, 434-510`
- Modify: `lib/actions/song-presets.ts:1-6, 70-125, 227-249`
- Modify: `components/shared/arrangement-editor/types.ts:1-25`
- Modify: `components/songs/preset-editor.tsx:13-25`
- Modify: `components/songs/preset-list.tsx:20-72`
- Modify: `components/songs/mashup-preset-dialog.tsx:15-31`
- Modify: `components/contis/mashup-connect-dialog.tsx:16-36`
- Create: `tests/preset-lyrics-conti-application-source.test.mjs`

**Interfaces:**
- Consumes: `resolvePresetLyrics` and `ResolvedSongPresetWithSheetMusic` from Task 1.
- Produces: repository/action methods that always return resolved presets when sheet-music/member context is requested.

- [ ] **Step 1: Write the failing repository wiring test**

Create `tests/preset-lyrics-conti-application-source.test.mjs`:

```js
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
```

- [ ] **Step 2: Run the source test and confirm it fails**

Run:

```bash
rtk pnpm vitest run tests/preset-lyrics-conti-application-source.test.mjs
```

Expected: FAIL because repository hydration does not yet attach resolved fields.

- [ ] **Step 3: Add a single Turso hydration helper**

Import `ResolvedSongPresetWithSheetMusic` and `resolvePresetLyrics` in `lib/repositories/storyboard/turso-repository.ts`. Add this helper after `getMashupFallbackLyrics`:

```ts
async function hydrateSongPreset(
  preset: SongPreset,
): Promise<ResolvedSongPresetWithSheetMusic> {
  const tursoDb = getTursoDb()
  const [sheetMusicRows, members] = await Promise.all([
    tursoDb
      .select({ sheetMusicFileId: presetSheetMusic.sheetMusicFileId })
      .from(presetSheetMusic)
      .where(eq(presetSheetMusic.presetId, preset.id))
      .orderBy(presetSheetMusic.sortOrder),
    getPresetMemberRows(preset.id),
  ])
  const sheetMusicFileIds = sheetMusicRows.map((row) => row.sheetMusicFileId)
  let availableSheetMusic: SheetMusicFile[] | undefined
  let songLyrics: string[] | undefined
  let fallbackLyrics: string[] | undefined

  if (preset.presetType === "mashup") {
    ;[availableSheetMusic, fallbackLyrics] = await Promise.all([
      getPresetEditorSheetMusicRows(members, sheetMusicFileIds),
      getMashupFallbackLyrics(members),
    ])
  } else {
    songLyrics = await getSongLyrics(preset.songId)
  }

  const hydrated: SongPresetWithSheetMusic = {
    ...preset,
    sheetMusicFileIds,
    members,
    availableSheetMusic,
    songLyrics,
    fallbackLyrics,
  }
  const resolution = resolvePresetLyrics(hydrated)

  return {
    ...hydrated,
    resolvedLyrics: resolution.lyrics,
    lyricsSource: resolution.source,
  }
}
```

Replace the duplicated bodies of the repository methods with:

```ts
async getSongPresetsWithSheetMusic(
  songId: string,
): Promise<ResolvedSongPresetWithSheetMusic[]> {
  const presets = await this.getSongPresets(songId)
  return Promise.all(presets.map(hydrateSongPreset))
},

async getSongPresetWithSheetMusic(
  presetId: string,
): Promise<ResolvedSongPresetWithSheetMusic | null> {
  const tursoDb = getTursoDb()
  const presetRows = await tursoDb
    .select()
    .from(songPresets)
    .where(eq(songPresets.id, presetId))
    .limit(1)

  return presetRows[0]
    ? hydrateSongPreset(mapSongPreset(presetRows[0]))
    : null
},
```

- [ ] **Step 4: Update repository and server-action return types**

In `lib/repositories/storyboard/types.ts`, import `ResolvedSongPresetWithSheetMusic` and change only the hydrated methods:

```ts
getSongPresetsWithSheetMusic(
  songId: string,
): Promise<ResolvedSongPresetWithSheetMusic[]>
getSongPresetWithSheetMusic(
  presetId: string,
): Promise<ResolvedSongPresetWithSheetMusic | null>
findMashupPresetBySongs(
  songIds: [string, string],
): Promise<ResolvedSongPresetWithSheetMusic | null>
```

In `lib/types.ts`, change the hydrated presets on song detail responses:

```ts
export interface SongWithSheetMusic extends Song {
  sheetMusic: SheetMusicFile[]
  presets?: ResolvedSongPresetWithSheetMusic[]
}
```

In `lib/actions/song-presets.ts`, import the resolved DTO and update these signatures:

```ts
findMashupPresetBySongs(
  firstSongId: string,
  secondSongId: string,
): Promise<ActionResult<ResolvedSongPresetWithSheetMusic | null>>

createMashupPreset(
  songIds: [string, string],
  data: SongPresetData,
): Promise<ActionResult<ResolvedSongPresetWithSheetMusic>>

getPresetsForSongWithSheetMusic(
  songId: string,
): Promise<ActionResult<ResolvedSongPresetWithSheetMusic[]>>

getSongPresetWithSheetMusic(
  presetId: string,
): Promise<ActionResult<ResolvedSongPresetWithSheetMusic>>
```

Keep `getPresetsForSong(): ActionResult<SongPreset[]>` unchanged because `youtube-import-state.ts` uses it only for selection metadata, not for applying arrangement data.

- [ ] **Step 5: Propagate the resolved type through existing hydrated consumers**

Change `ArrangementEditorPresetOption` in `components/shared/arrangement-editor/types.ts`:

```ts
import type {
  PresetPdfMetadata,
  ResolvedSongPresetWithSheetMusic,
  SheetMusicFile,
  SongPreset,
} from "@/lib/types"

export type ArrangementEditorPresetOption = ResolvedSongPresetWithSheetMusic
```

Use `ResolvedSongPresetWithSheetMusic` instead of `SongPresetWithSheetMusic` for the hydrated values in these files:

```ts
// components/songs/preset-editor.tsx
interface PresetEditorProps {
  songId: string
  songLyrics: string[]
  preset?: ResolvedSongPresetWithSheetMusic
  sheetMusic: SheetMusicFile[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

// components/songs/preset-list.tsx
interface PresetListProps {
  songId: string
  songName: string
  songLyrics: string[]
  presets: ResolvedSongPresetWithSheetMusic[]
  sheetMusic: SheetMusicFile[]
  allSongs: Song[]
}
```

Also change `editingPreset`, `handleMashupPresetReady`, `handleEditClick`, `MashupPresetDialog.onPresetReady`, and `MashupConnectDialog`'s `found` state to `ResolvedSongPresetWithSheetMusic`. Do not change `buildPresetEditorSheetMusic`, which can accept the resolved subtype through its existing base interface.

Use these exact declarations:

```ts
// components/songs/preset-list.tsx
const [editingPreset, setEditingPreset] = useState<
  ResolvedSongPresetWithSheetMusic | undefined
>()
const handleMashupPresetReady = (
  preset: ResolvedSongPresetWithSheetMusic,
) => {
  setEditingPreset(preset)
  setEditorOpen(true)
}
const handleEditClick = (preset: ResolvedSongPresetWithSheetMusic) => {
  setEditingPreset(preset)
  setEditorOpen(true)
}

// components/songs/mashup-preset-dialog.tsx
interface MashupPresetDialogProps {
  currentSongId: string
  currentSongName: string
  allSongs: Song[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onPresetReady: (preset: ResolvedSongPresetWithSheetMusic) => void
}

// components/contis/mashup-connect-dialog.tsx
type PresetCheckState =
  | { status: "idle" | "loading" }
  | { status: "error"; message: string }
  | { status: "found"; preset: ResolvedSongPresetWithSheetMusic }
  | { status: "empty" }
```

- [ ] **Step 6: Run focused tests and typecheck**

Run:

```bash
rtk pnpm vitest run lib/utils/preset-lyrics.test.ts tests/preset-lyrics-conti-application-source.test.mjs
rtk pnpm exec tsc --noEmit
```

Expected: both test files pass and TypeScript confirms all hydrated consumers agree on the resolved DTO.

- [ ] **Step 7: Commit the server DTO contract**

```bash
rtk git add lib/types.ts lib/repositories/storyboard/types.ts lib/repositories/storyboard/turso-repository.ts lib/actions/song-presets.ts components/shared/arrangement-editor/types.ts components/songs/preset-editor.tsx components/songs/preset-list.tsx components/songs/mashup-preset-dialog.tsx components/contis/mashup-connect-dialog.tsx tests/preset-lyrics-conti-application-source.test.mjs
rtk git commit -m "feat: expose resolved preset lyrics"
```

---

### Task 3: Shared Converters And Server Application Paths

**Files:**
- Modify: `lib/utils/song-preset-draft.test.ts:1-120`
- Modify: `lib/utils/song-preset-draft.ts:1-35`
- Modify: `lib/utils/preset-overrides.test.ts:1-55`
- Modify: `lib/utils/preset-overrides.ts:1-45`
- Modify: `lib/repositories/storyboard/turso-repository.ts:285-306, 1120-1155, 1366-1375`
- Modify: `tests/preset-lyrics-conti-application-source.test.mjs`

**Interfaces:**
- Consumes: `ResolvedSongPresetWithSheetMusic` returned by Task 2.
- Produces: `songPresetToDraft(resolvedPreset)` and `songPresetToContiOverrides(resolvedPreset, fileIds)` that cannot consume a raw `SongPreset`.

- [ ] **Step 1: Write failing converter regressions**

In `lib/utils/song-preset-draft.test.ts`, replace the type import with:

```ts
import type { ResolvedSongPresetWithSheetMusic } from "../types.ts"
```

Change the existing fixture annotation to `ResolvedSongPresetWithSheetMusic`, then insert these properties before its closing brace:

```ts
  resolvedLyrics: ["line 1", "line 2"],
  lyricsSource: "mashup-snapshot",
```

Replace the three tests that ask `songPresetToDraft` to perform fallback selection with this server-contract regression:

```ts
test("songPresetToDraft uses server-resolved lyrics instead of raw storage", () => {
  const draft = songPresetToDraft({
    ...preset,
    presetType: "single",
    lyrics: JSON.stringify([]),
    songLyrics: ["canonical page"],
    resolvedLyrics: ["canonical page"],
    lyricsSource: "song",
  })

  assert.deepEqual(draft.lyrics, ["canonical page"])
})
```

In `lib/utils/preset-overrides.test.ts`, change the fixture so raw storage is empty but the resolved contract contains canonical lyrics:

```ts
const preset = {
  id: "preset-1",
  keys: JSON.stringify(["G", "A"]),
  tempos: JSON.stringify([72, 84]),
  sectionOrder: JSON.stringify(["Intro", "V", "C"]),
  lyrics: JSON.stringify([]),
  resolvedLyrics: ["line 1", "line 2"],
  sectionLyricsMap: JSON.stringify({ 0: [0], 2: [1] }),
  notes: "soft intro",
}
```

The first assertion must remain the complete conti snapshot shape:

```ts
assert.deepEqual(songPresetToContiOverrides(preset, ["sheet-1", "sheet-2"]), {
  keys: ["G", "A"],
  tempos: [72, 84],
  sectionOrder: ["Intro", "V", "C"],
  lyrics: ["line 1", "line 2"],
  sectionLyricsMap: { 0: [0], 2: [1] },
  notes: "soft intro",
  sheetMusicFileIds: ["sheet-1", "sheet-2"],
  presetId: "preset-1",
})
```

- [ ] **Step 2: Add the failing server-path source guards**

Append to `tests/preset-lyrics-conti-application-source.test.mjs`:

```js
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
```

- [ ] **Step 3: Run the focused tests and confirm they fail**

Run:

```bash
rtk pnpm vitest run lib/utils/song-preset-draft.test.ts lib/utils/preset-overrides.test.ts tests/preset-lyrics-conti-application-source.test.mjs
```

Expected: FAIL because both converters still read raw `preset.lyrics`, and YouTube-created presets still bypass repository hydration.

- [ ] **Step 4: Make the draft converter consume the resolved DTO**

In `lib/utils/song-preset-draft.ts`, import `ResolvedSongPresetWithSheetMusic`, delete `getPresetLyrics`, and use the server field:

```ts
export function songPresetToDraft(
  preset: ResolvedSongPresetWithSheetMusic | undefined,
): ArrangementDraft {
  return {
    name: preset?.name ?? "",
    displayTitle: preset?.displayTitle ?? null,
    keys: parseJsonField<string[]>(preset?.keys ?? null, []),
    tempos: parseJsonField<number[]>(preset?.tempos ?? null, []),
    sectionOrder: parseJsonField<string[]>(preset?.sectionOrder ?? null, []),
    lyrics: preset?.resolvedLyrics ? [...preset.resolvedLyrics] : [],
    sectionLyricsMap: parseJsonField<Record<number, number[]>>(
      preset?.sectionLyricsMap ?? null,
      {},
    ),
    notes: preset?.notes ?? null,
    sheetMusicFileIds: preset?.sheetMusicFileIds?.length
      ? preset.sheetMusicFileIds
      : null,
    pdfMetadata: parseJsonField<PresetPdfMetadata | null>(
      preset?.pdfMetadata ?? null,
      null,
    ),
    youtubeReference: toYouTubeInputValue(preset?.youtubeReference),
    youtubeTitle: preset?.youtubeTitle ?? null,
    isDefault: preset?.isDefault ?? false,
    appliedPresetId: preset?.id ?? null,
  }
}
```

Leave `arrangementDraftToSongPresetData` unchanged.

- [ ] **Step 5: Make the conti converter require resolved lyrics**

In `lib/utils/preset-overrides.ts`, replace the source type and the lyrics assignment:

```ts
import type {
  ContiSongOverrides,
  ResolvedSongPresetWithSheetMusic,
} from "../types"

type PresetArrangementSource = Pick<
  ResolvedSongPresetWithSheetMusic,
  | "id"
  | "keys"
  | "tempos"
  | "sectionOrder"
  | "resolvedLyrics"
  | "sectionLyricsMap"
  | "notes"
>

export function songPresetToContiOverrides(
  preset: PresetArrangementSource,
  sheetMusicFileIds: string[] = [],
): ContiSongOverrides {
  return {
    keys: parseJsonField<string[]>(preset.keys, []),
    tempos: parseJsonField<number[]>(preset.tempos, []),
    sectionOrder: parseJsonField<string[]>(preset.sectionOrder, []),
    lyrics: [...preset.resolvedLyrics],
    sectionLyricsMap: parseJsonField<Record<number, number[]>>(
      preset.sectionLyricsMap,
      {},
    ),
    notes: preset.notes,
    sheetMusicFileIds: sheetMusicFileIds.length > 0 ? sheetMusicFileIds : null,
    presetId: preset.id,
  }
}
```

- [ ] **Step 6: Hydrate server-side apply/restore/import paths**

Change `getPresetOverridesForSong` in `lib/repositories/storyboard/turso-repository.ts` after membership validation:

```ts
const preset = await hydrateSongPreset(
  mapSongPreset(presetRows[0].song_presets),
)

return songPresetToContiOverrides(preset, preset.sheetMusicFileIds)
```

Delete the duplicated `presetSheetMusic` query from that helper because hydration already provides the ordered file ids.

In both `insertTursoSongPreset` branches inside `batchImportSongsToConti`, retain `appliedPresetId = preset.id` but delete:

```ts
appliedPresetOverrides = songPresetToContiOverrides(preset)
```

The existing common block immediately below must remain:

```ts
if (appliedPresetId && !appliedPresetOverrides) {
  appliedPresetOverrides = await getPresetOverridesForSong(
    appliedPresetId,
    resolvedSongId,
  )
  if (!appliedPresetOverrides) {
    throw new Error("PRESET_NOT_FOUND")
  }
}
```

`applyMashupToContiSongs` continues calling `songPresetToContiOverrides(preset, preset.sheetMusicFileIds)` because `getSongPresetWithSheetMusic` now returns the resolved DTO.

- [ ] **Step 7: Run converter, server-path, and type tests**

Run:

```bash
rtk pnpm vitest run lib/utils/preset-lyrics.test.ts lib/utils/song-preset-draft.test.ts lib/utils/preset-overrides.test.ts tests/preset-lyrics-conti-application-source.test.mjs lib/repositories/storyboard/mashup-apply.test.ts
rtk pnpm exec tsc --noEmit
```

Expected: all focused tests pass; raw `SongPreset` calls to the conti converter are eliminated by TypeScript.

- [ ] **Step 8: Commit the shared conversion behavior**

```bash
rtk git add lib/utils/song-preset-draft.ts lib/utils/song-preset-draft.test.ts lib/utils/preset-overrides.ts lib/utils/preset-overrides.test.ts lib/repositories/storyboard/turso-repository.ts tests/preset-lyrics-conti-application-source.test.mjs
rtk git commit -m "fix: apply resolved lyrics to conti presets"
```

---

### Task 4: Conti Client Wiring

**Files:**
- Modify: `components/contis/conti-song-editor.tsx:1-90, 100-130, 238-250`
- Modify: `components/contis/song-picker.tsx:12-120`
- Modify: `tests/preset-lyrics-conti-application-source.test.mjs`

**Interfaces:**
- Consumes: resolved preset actions and shared converters from Tasks 2-3.
- Produces: default/manual add and editor reload flows that never parse raw preset lyrics.

- [ ] **Step 1: Write failing client source guards**

Append to `tests/preset-lyrics-conti-application-source.test.mjs`:

```js
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
```

- [ ] **Step 2: Run the source guard and confirm it fails**

Run:

```bash
rtk pnpm vitest run tests/preset-lyrics-conti-application-source.test.mjs
```

Expected: FAIL because both clients still call the lightweight raw-preset action and parse raw `lyrics`.

- [ ] **Step 3: Replace SongPicker's duplicated override assembly**

Update imports and state in `components/contis/song-picker.tsx`:

```ts
import { getPresetsForSongWithSheetMusic } from "@/lib/actions/song-presets"
import { songPresetToContiOverrides } from "@/lib/utils/preset-overrides"
import type {
  ContiSongOverrides,
  ResolvedSongPresetWithSheetMusic,
  Song,
} from "@/lib/types"

const [presets, setPresets] = useState<ResolvedSongPresetWithSheetMusic[]>([])
```

In `handleSongClick`, call the resolved action and replace the default override object:

```ts
const result = await getPresetsForSongWithSheetMusic(song.id)

if (result.success && result.data && result.data.length > 0) {
  const defaultPreset = result.data.find((preset) => preset.isDefault)
  if (defaultPreset) {
    const overrides = songPresetToContiOverrides(
      defaultPreset,
      defaultPreset.sheetMusicFileIds,
    )
    const addResult = await addSongToConti(contiId, song.id, overrides)
    if (addResult.success) {
      toast.success(`"${defaultPreset.name}" 프리셋이 적용되었습니다`)
      onOpenChange(false)
      resetState()
    } else {
      toast.error(addResult.error ?? "곡 추가 중 오류가 발생했습니다")
    }
  } else {
    setSelectedSong(song)
    setPresets(result.data)
    setShowPresetStep(true)
  }
} else {
  handleSelect(song.id)
}
```

Change the manual handler signature and conversion:

```ts
function handlePresetSelect(
  preset: ResolvedSongPresetWithSheetMusic | null,
) {
  if (!selectedSong) return

  startTransition(async () => {
    const overrides: Partial<ContiSongOverrides> | undefined = preset
      ? songPresetToContiOverrides(preset, preset.sheetMusicFileIds)
      : undefined
    const result = await addSongToConti(
      contiId,
      selectedSong.id,
      overrides,
    )

    if (result.success) {
      toast.success("곡이 추가되었습니다")
      onOpenChange(false)
      resetState()
    } else {
      toast.error(result.error ?? "곡 추가 중 오류가 발생했습니다")
    }
  })
}
```

Delete every direct `JSON.parse` of preset arrangement fields and both `getPresetSheetMusicFileIds` calls from this component.

- [ ] **Step 4: Replace ContiSongEditor's local preset converter**

Update imports and state in `components/contis/conti-song-editor.tsx`:

```ts
import { getPresetsForSongWithSheetMusic } from "@/lib/actions/song-presets"
import { songPresetToDraft } from "@/lib/utils/song-preset-draft"
import type {
  ContiSongWithSong,
  ResolvedSongPresetWithSheetMusic,
  SheetMusicFile,
} from "@/lib/types"

const [presets, setPresets] = useState<ResolvedSongPresetWithSheetMusic[]>([])
```

Delete the local `parseJsonField` and `presetToDraft` functions. Change `refreshPresets` to call `getPresetsForSongWithSheetMusic(songId)`. Remove the cast on `presetOptions` and use:

```tsx
presetOptions={presets}
onLoadPreset={async (preset) => ({
  ...songPresetToDraft(preset),
  name: contiSong.song.name,
  displayTitle: null,
  isDefault: false,
})}
```

Delete the `getPresetSheetMusicFileIds` import and request; the hydrated preset already has ordered `sheetMusicFileIds`.

- [ ] **Step 5: Run client guards, focused unit tests, and typecheck**

Run:

```bash
rtk pnpm vitest run tests/preset-lyrics-conti-application-source.test.mjs lib/utils/preset-overrides.test.ts lib/utils/song-preset-draft.test.ts
rtk pnpm exec tsc --noEmit
```

Expected: source guards pass, converter tests pass, and no cast is required between client preset options and resolved action results.

- [ ] **Step 6: Commit the client wiring**

```bash
rtk git add components/contis/song-picker.tsx components/contis/conti-song-editor.tsx tests/preset-lyrics-conti-application-source.test.mjs
rtk git commit -m "fix: load resolved lyrics in conti clients"
```

---

### Task 5: Full Verification And Read-Only Smoke Test

**Files:**
- Verify: all files changed in Tasks 1-4
- Reference: `docs/superpowers/specs/2026-07-12-lyrics-preset-compatibility-design.md`

**Interfaces:**
- Consumes: the completed resolved-lyrics pipeline.
- Produces: evidence that the repository, clients, and existing app behavior remain valid without a Production DB write.

- [ ] **Step 1: Run all focused regression tests together**

```bash
rtk pnpm vitest run lib/utils/preset-lyrics.test.ts lib/utils/song-preset-draft.test.ts lib/utils/preset-overrides.test.ts tests/preset-lyrics-conti-application-source.test.mjs lib/repositories/storyboard/mashup-apply.test.ts tests/preset-lyrics-save-scope-source.test.mjs
```

Expected: all focused files pass.

- [ ] **Step 2: Run the complete test suite**

```bash
rtk pnpm test
```

Expected: the complete Vitest suite passes with zero failures.

- [ ] **Step 3: Run static verification**

```bash
rtk pnpm exec tsc --noEmit
rtk pnpm lint
rtk pnpm build
```

Expected: TypeScript exits 0, ESLint reports no errors, and Next.js production build completes.

- [ ] **Step 4: Start the local app with the existing main-checkout environment**

From `/Users/mac_al03255498/.codex/worktrees/0447/selah`, run:

```bash
rtk node --env-file=/Users/mac_al03255498/code/selah/.env.local node_modules/next/dist/bin/next dev
```

Expected: Next.js starts on `http://localhost:3000` without copying or printing credentials.

- [ ] **Step 5: Perform a read-only browser smoke test**

Use the existing Production-backed test fixture without clicking any save/add action:

- Conti route: `/contis/pcIc-mkGrHsJ` (`2026-07-17`, `재광 (26여름수련회 집회)`).
- Conti song row: `KeB_DIcHEXm7`.
- Song: `합심` (`x-33hEaaq-wb`), canonical lyrics page count `6`.
- Preset: `2026-07-17` (`1SOzCA-YxPt8`), raw preset lyrics page count `0`.
- Open the listed conti, open `합심` in the conti-song editor, and load `2026-07-17`.
- Confirm the draft displays 6 lyric pages.
- Close the editor without saving.

Expected: the editor shows the canonical six pages; Production data is unchanged.

- [ ] **Step 6: Confirm the worktree contains only intended changes**

```bash
rtk git status --short
rtk git diff --check
rtk git log --oneline -5
```

Expected: no unstaged implementation changes, no whitespace errors, and the four implementation commits from Tasks 1-4 are visible.

Do not create a data-migration commit: the audited migration candidate count is zero.
