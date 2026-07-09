import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { test } from "vitest"

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8")

function sliceBetween(source, startPattern, endPattern) {
  const start = source.search(startPattern)
  assert.notEqual(start, -1, `missing start pattern ${startPattern}`)
  const rest = source.slice(start)
  const end = rest.search(endPattern)
  assert.notEqual(end, -1, `missing end pattern ${endPattern}`)
  return rest.slice(0, end)
}

test("pdf autosave debounces first edit and collapses overlapping saves", async () => {
  const source = await read("components/contis/pdf-export/hooks/use-auto-save.ts")

  assert.doesNotMatch(source, /lastSaveRef/)
  assert.match(source, /activeSavePromiseRef/)
  assert.match(source, /pendingSaveRef/)
  assert.match(source, /saveLatestRef/)

  const triggerBody = sliceBetween(
    source,
    /const triggerAutoSave = useCallback/,
    /async function handleManualSave/
  )
  const timerStart = triggerBody.search(
    /saveTimerRef\.current\s*=\s*setTimeout/
  )
  assert.notEqual(
    timerStart,
    -1,
    "triggerAutoSave should assign saveTimerRef.current with setTimeout"
  )
  const beforeTimer = triggerBody.slice(0, timerStart)

  assert.match(triggerBody, /setTimeout/)
  assert.match(triggerBody, /3000/)
  assert.match(triggerBody, /saveLatestRef\.current\(\)/)
  assert.doesNotMatch(beforeTimer, /saveLatestRef\.current\(\)/)
  assert.doesNotMatch(beforeTimer, /performSaveRef\.current\(\)/)
  assert.doesNotMatch(triggerBody, /Date\.now/)
  assert.doesNotMatch(triggerBody, /return;\s*\}/)
})

test("editor seeds pages once per conti and does not rebuild on RSC refresh", async () => {
  const source = await read("components/contis/pdf-export/hooks/use-editor-pages.ts")

  // The editor owns its layout state after seeding from server data. A guard
  // ref keyed on conti.id stops the init effect from rebuilding the whole
  // editor (clobbering in-progress edits + flashing the loading skeleton) when
  // conti/existingExport arrive as new object references from an RSC refresh
  // (e.g. an autosave-triggered read-your-writes refresh). Explicit rebuilds go
  // through reloadFromPreset, not this effect.
  assert.match(source, /seededContiIdRef/)
  assert.match(source, /seededContiIdRef\.current\s*===\s*conti\.id/)
  // The guard is marked seeded only after a successful build so an interrupted
  // initial build cannot leave the editor stuck on the loading skeleton.
  assert.match(source, /seededContiIdRef\.current\s*=\s*conti\.id/)
})

test("overlay dragging updates local state during move and autosaves once on pointer up", async () => {
  const source = await read("components/contis/pdf-export/hooks/use-overlays.ts")

  assert.match(source, /hasDraggedRef/)
  assert.match(source, /updateOverlayPosition/)

  const moveBody = sliceBetween(
    source,
    /function handlePointerMove/,
    /function handlePointerUp/
  )
  assert.match(moveBody, /updateOverlayPosition\(overlayId/)
  assert.match(moveBody, /hasDraggedRef\.current\s*=\s*true/)
  assert.doesNotMatch(moveBody, /triggerAutoSave\(\)/)
  assert.doesNotMatch(moveBody, /updateOverlay\(overlayId/)
  assert.match(moveBody, /pointerStartRef\.current\.x/)
  assert.match(moveBody, /pointerStartRef\.current\.y/)
  assert.match(moveBody, /const distance\s*=\s*Math\.sqrt\(dx \* dx \+ dy \* dy\)/)
  assert.match(
    moveBody,
    /if\s*\(\s*!hasDraggedRef\.current\s*&&\s*distance\s*<\s*5\s*\)\s*return/
  )

  const distanceCheck = moveBody.search(
    /if\s*\(\s*!hasDraggedRef\.current\s*&&\s*distance\s*<\s*5\s*\)\s*return/
  )
  const markDragged = moveBody.search(/hasDraggedRef\.current\s*=\s*true/)
  const positionUpdate = moveBody.search(/updateOverlayPosition\(overlayId/)
  assert.ok(
    distanceCheck < markDragged,
    "pointer move should ignore shaky clicks before marking as dragged"
  )
  assert.ok(
    distanceCheck < positionUpdate,
    "pointer move should ignore shaky clicks before updating position"
  )

  const upBody = sliceBetween(
    source,
    /function handlePointerUp/,
    /return \{/
  )
  assert.match(upBody, /hasDraggedRef\.current/)
  assert.match(
    upBody,
    /if\s*\(\s*hasDraggedRef\.current\s*\)\s*\{[\s\S]*triggerAutoSave\(\)[\s\S]*\}\s*else\s*\{[\s\S]*setSelectedOverlayId\(overlayId\)/
  )
  assert.doesNotMatch(upBody, /distance\s*<\s*5/)
  assert.match(upBody, /triggerAutoSave\(\)/)
})
